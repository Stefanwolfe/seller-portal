import os
import json
import uuid
import shutil
import secrets
import time
from datetime import datetime, timedelta, date
from typing import Optional, List
from contextlib import asynccontextmanager
from collections import defaultdict

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

import resend

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey, Date, Enum as SAEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.dialects.postgresql import JSON

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


# ─── Config ───────────────────────────────────────────────────────────────────
class Settings(BaseSettings):
    database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/seller_portal")
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    upload_dir: str = os.getenv("UPLOAD_DIR", "./uploads")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    resend_api_key: str = os.getenv("RESEND_API_KEY", "")
    portal_url: str = os.getenv("PORTAL_URL", "http://localhost:8000")
    from_email: str = os.getenv("FROM_EMAIL", "DC Concierge <onboarding@resend.dev>")

settings = Settings()

# ─── Database ─────────────────────────────────────────────────────────────────
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="client")  # admin, client
    full_name = Column(String(200))
    email = Column(String(200))
    phone = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    # For clients: link to properties
    property_accesses = relationship("PropertyAccess", back_populates="user")


class Property(Base):
    __tablename__ = "properties"
    id = Column(Integer, primary_key=True, index=True)
    address = Column(String(300), nullable=False)
    street_number = Column(String(20))
    city = Column(String(100))
    state = Column(String(50), default="WA")
    zip_code = Column(String(20))
    mls_number = Column(String(50))
    list_price = Column(Float)
    list_date = Column(Date)
    status = Column(String(50), default="Active")  # Coming Soon, Active, Pending, Sold, Withdrawn
    bedrooms = Column(Integer)
    bathrooms = Column(Float)
    sqft = Column(Integer)
    description = Column(Text)
    hero_photo_url = Column(String(500))
    gallery_url = Column(String(500))
    is_archived = Column(Boolean, default=False)
    archived_at = Column(DateTime)
    phase = Column(String(20), default="active")  # pre_market, active, pending
    target_live_date = Column(Date)
    # Pending phase structured dates
    mutual_date = Column(Date)
    inspection_deadline = Column(Date)
    inspection_response_received = Column(Boolean, default=False)
    inspection_response_days = Column(Integer, default=3)
    inspection_response_date = Column(Date)
    earnest_money_date = Column(Date)
    closing_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Relationships
    photos = relationship("PropertyPhoto", back_populates="property", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="property", cascade="all, delete-orphan")
    marketing_items = relationship("MarketingItem", back_populates="property", cascade="all, delete-orphan")
    property_accesses = relationship("PropertyAccess", back_populates="property", cascade="all, delete-orphan")
    pre_market_tasks = relationship("PreMarketTask", back_populates="property", cascade="all, delete-orphan")
    pending_milestones = relationship("PendingMilestone", back_populates="property", cascade="all, delete-orphan")
    custom_sections = relationship("CustomPhaseSection", back_populates="property", cascade="all, delete-orphan")
    vendor_appointments = relationship("VendorAppointment", back_populates="property", cascade="all, delete-orphan")


class PropertyAccess(Base):
    __tablename__ = "property_accesses"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    user = relationship("User", back_populates="property_accesses")
    property = relationship("Property", back_populates="property_accesses")


class PropertyPhoto(Base):
    __tablename__ = "property_photos"
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    filename = Column(String(300), nullable=False)
    url = Column(String(500), nullable=False)
    sort_order = Column(Integer, default=0)
    is_hero = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    property = relationship("Property", back_populates="photos")


class Activity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    activity_type = Column(String(50), nullable=False)  # showing, open_house, broker_open, agent_preview
    activity_date = Column(DateTime, nullable=False)
    brokerage = Column(String(200))
    visitor_count = Column(Integer, default=1)
    feedback_raw = Column(Text)       # Raw feedback from Alfred or manual entry
    feedback_draft = Column(Text)     # Alfred-drafted client-facing feedback
    feedback_approved = Column(Text)  # Final approved feedback shown to clients
    is_approved = Column(Boolean, default=False)
    is_pushed = Column(Boolean, default=False)  # Pushed to client portal
    pushed_at = Column(DateTime)
    source = Column(String(50), default="manual")  # manual, csv_import, alfred
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100))
    property = relationship("Property", back_populates="activities")


class MarketingItem(Base):
    __tablename__ = "marketing_items"
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    item_type = Column(String(100), nullable=False)  # professional_photos, virtual_tour, flyer, social_media, print_ad, email_blast, video, 3d_tour, signage, etc.
    title = Column(String(300), nullable=False)
    description = Column(Text)
    url = Column(String(500))
    completed_date = Column(Date)
    is_pushed = Column(Boolean, default=False)
    pushed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    property = relationship("Property", back_populates="marketing_items")


class InviteToken(Base):
    __tablename__ = "invite_tokens"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(200), nullable=False)
    full_name = Column(String(200))
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    used_at = Column(DateTime)
    property = relationship("Property")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    user = relationship("User")


class PreMarketTask(Base):
    __tablename__ = "pre_market_tasks"
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    title = Column(String(300), nullable=False)
    category = Column(String(50), default="vendor")  # vendor, todo, inspection_item
    task_type = Column(String(100))  # photography, staging, repairs, inspection, signage, custom
    scheduled_date = Column(Date)
    status = Column(String(50), default="pending")  # pending, scheduled, in_progress, complete
    notes = Column(Text)
    receipt_url = Column(String(500))  # For inspection items - uploaded receipt
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    property = relationship("Property", back_populates="pre_market_tasks")


class PendingMilestone(Base):
    __tablename__ = "pending_milestones"
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    title = Column(String(300), nullable=False)
    milestone_type = Column(String(100))  # inspection, financing, title, closing, walkthrough, custom
    due_date = Column(Date)
    status = Column(String(50), default="upcoming")  # upcoming, in_progress, complete, waived
    notes = Column(Text)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    property = relationship("Property", back_populates="pending_milestones")


class CustomPhaseSection(Base):
    __tablename__ = "custom_phase_sections"
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    phase = Column(String(20), nullable=False)  # pre_market, pending
    title = Column(String(300), nullable=False)
    section_type = Column(String(20), default="checklist")  # date, checklist
    date_value = Column(Date)  # if section_type is date
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    property = relationship("Property", back_populates="custom_sections")
    items = relationship("CustomPhaseSectionItem", back_populates="section", cascade="all, delete-orphan")


class CustomPhaseSectionItem(Base):
    __tablename__ = "custom_phase_section_items"
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("custom_phase_sections.id"), nullable=False)
    title = Column(String(300), nullable=False)
    status = Column(String(50), default="pending")  # pending, complete
    sort_order = Column(Integer, default=0)
    section = relationship("CustomPhaseSection", back_populates="items")


class VendorAppointment(Base):
    __tablename__ = "vendor_appointments"
    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    vendor_name = Column(String(200), nullable=False)
    company = Column(String(200))
    phone = Column(String(50))
    email = Column(String(200))
    service_type = Column(String(100))  # photography, staging, inspection, repairs, cleaning, other
    scheduled_date = Column(DateTime)
    notes = Column(Text)  # prep instructions for the client
    status = Column(String(50), default="upcoming")  # upcoming, confirmed, complete, cancelled
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    property = relationship("Property", back_populates="vendor_appointments")


# ─── Auth ─────────────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── Rate Limiting ────────────────────────────────────────────────────────────
login_attempts = defaultdict(list)  # username -> [timestamp, ...]
MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 900  # 15 minutes

def check_rate_limit(username: str):
    now = time.time()
    # Clean old attempts
    login_attempts[username] = [t for t in login_attempts[username] if now - t < LOCKOUT_SECONDS]
    if len(login_attempts[username]) >= MAX_ATTEMPTS:
        remaining = int(LOCKOUT_SECONDS - (now - login_attempts[username][0]))
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {remaining // 60} minutes."
        )

def record_failed_attempt(username: str):
    login_attempts[username].append(time.time())

def clear_attempts(username: str):
    login_attempts.pop(username, None)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

async def get_current_user(request: Request, db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    # Read token from HTTP-only cookie
    token = request.cookies.get("sp_session")
    if not token:
        # Fallback: check Authorization header for backwards compatibility during transition
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
        else:
            raise credentials_exception
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

async def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def set_auth_cookie(response: Response, token: str):
    """Set an HTTP-only secure cookie with the session token."""
    is_production = "railway" in settings.portal_url or "https" in settings.portal_url
    response.set_cookie(
        key="sp_session",
        value=token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


def send_invite_email(email: str, full_name: str, token: str, property_address: str):
    """Send an invite email via Resend."""
    if not settings.resend_api_key:
        print(f"[INVITE] No Resend API key — invite link: {settings.portal_url}/accept-invite?token={token}")
        return
    resend.api_key = settings.resend_api_key
    invite_url = f"{settings.portal_url}/accept-invite?token={token}"
    resend.Emails.send({
        "from": settings.from_email,
        "to": [email],
        "subject": f"Welcome to Your DC Concierge Seller Portal",
        "html": f"""
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 28px; color: #2C2C2C; margin: 0;">DC Concierge</h1>
                <p style="color: #B8926A; font-size: 14px; margin-top: 4px;">Seller Portal</p>
            </div>
            <p style="font-size: 16px; color: #2C2C2C;">Hi {full_name},</p>
            <p style="font-size: 16px; color: #4A4A4A; line-height: 1.6;">
                Your personalized seller portal for <strong>{property_address}</strong> is ready.
                Click the button below to set your password and access your dashboard.
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{invite_url}" style="background: #B8926A; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                    Set Up Your Account
                </a>
            </div>
            <p style="font-size: 13px; color: #9B9B9B; line-height: 1.5;">
                This link expires in 48 hours. If you didn't expect this email, you can safely ignore it.
            </p>
        </div>
        """
    })


def send_reset_email(email: str, full_name: str, token: str):
    """Send a password reset email via Resend."""
    if not settings.resend_api_key:
        print(f"[RESET] No Resend API key — reset link: {settings.portal_url}/reset-password?token={token}")
        return
    resend.api_key = settings.resend_api_key
    reset_url = f"{settings.portal_url}/reset-password?token={token}"
    resend.Emails.send({
        "from": settings.from_email,
        "to": [email],
        "subject": "Reset Your DC Concierge Password",
        "html": f"""
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 28px; color: #2C2C2C; margin: 0;">DC Concierge</h1>
                <p style="color: #B8926A; font-size: 14px; margin-top: 4px;">Seller Portal</p>
            </div>
            <p style="font-size: 16px; color: #2C2C2C;">Hi {full_name},</p>
            <p style="font-size: 16px; color: #4A4A4A; line-height: 1.6;">
                We received a request to reset your password. Click below to choose a new one.
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{reset_url}" style="background: #B8926A; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                    Reset Password
                </a>
            </div>
            <p style="font-size: 13px; color: #9B9B9B; line-height: 1.5;">
                This link expires in 1 hour. If you didn't request this, you can safely ignore it.
            </p>
        </div>
        """
    })


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str = "client"

class ClientSignup(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None

class PropertyCreate(BaseModel):
    address: str
    street_number: Optional[str] = None
    city: Optional[str] = None
    state: str = "WA"
    zip_code: Optional[str] = None
    mls_number: Optional[str] = None
    list_price: Optional[float] = None
    list_date: Optional[date] = None
    status: str = "Active"
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    sqft: Optional[int] = None
    description: Optional[str] = None
    gallery_url: Optional[str] = None

class PropertyUpdate(BaseModel):
    address: Optional[str] = None
    street_number: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    mls_number: Optional[str] = None
    list_price: Optional[float] = None
    list_date: Optional[date] = None
    status: Optional[str] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    sqft: Optional[int] = None
    description: Optional[str] = None
    gallery_url: Optional[str] = None

class ActivityCreate(BaseModel):
    property_id: int
    activity_type: str
    activity_date: datetime
    brokerage: Optional[str] = None
    visitor_count: int = 1
    feedback_raw: Optional[str] = None

class ActivityUpdate(BaseModel):
    feedback_approved: Optional[str] = None
    is_approved: Optional[bool] = None
    is_pushed: Optional[bool] = None

class MarketingItemCreate(BaseModel):
    property_id: int
    item_type: str
    title: str
    description: Optional[str] = None
    url: Optional[str] = None
    completed_date: Optional[date] = None

class ClientPropertyAccess(BaseModel):
    user_id: int
    property_id: int

class InviteRequest(BaseModel):
    email: str
    full_name: str
    property_id: int

class AcceptInviteRequest(BaseModel):
    token: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

class PhaseUpdate(BaseModel):
    phase: str  # pre_market, active, pending
    target_live_date: Optional[date] = None

class PreMarketTaskCreate(BaseModel):
    property_id: int
    title: str
    category: str = "vendor"  # vendor, todo, inspection_item
    task_type: str = "custom"
    scheduled_date: Optional[date] = None
    status: str = "pending"
    notes: Optional[str] = None

class PreMarketTaskUpdate(BaseModel):
    title: Optional[str] = None
    scheduled_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PendingDatesUpdate(BaseModel):
    mutual_date: Optional[date] = None
    inspection_deadline: Optional[date] = None
    earnest_money_date: Optional[date] = None
    closing_date: Optional[date] = None

class InspectionToggle(BaseModel):
    received: bool
    response_days: int = 3

class CustomSectionCreate(BaseModel):
    phase: str
    title: str
    section_type: str = "checklist"  # date, checklist
    date_value: Optional[date] = None

class CustomSectionItemCreate(BaseModel):
    title: str

class PendingMilestoneCreate(BaseModel):
    property_id: int
    title: str
    milestone_type: str = "custom"
    due_date: Optional[date] = None
    status: str = "upcoming"
    notes: Optional[str] = None

class PendingMilestoneUpdate(BaseModel):
    title: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class VendorAppointmentCreate(BaseModel):
    property_id: int
    vendor_name: str
    company: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    service_type: str = "other"
    scheduled_date: Optional[datetime] = None
    notes: Optional[str] = None
    status: str = "upcoming"

class VendorAppointmentUpdate(BaseModel):
    vendor_name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    service_type: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[str] = None


# ─── App ──────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Migrate: add gallery_url column if missing
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE properties ADD COLUMN gallery_url VARCHAR(500)"))
            conn.commit()
        except Exception:
            conn.rollback()
    # Migrate: add is_archived and archived_at columns
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE properties ADD COLUMN is_archived BOOLEAN DEFAULT FALSE"))
            conn.commit()
        except Exception:
            conn.rollback()
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE properties ADD COLUMN archived_at TIMESTAMP"))
            conn.commit()
        except Exception:
            conn.rollback()
    # Migrate: create invite_tokens and password_reset_tokens tables
    Base.metadata.create_all(bind=engine)
    # Migrate: add phase and target_live_date columns
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE properties ADD COLUMN phase VARCHAR(20) DEFAULT 'active'"))
            conn.commit()
        except Exception:
            conn.rollback()
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE properties ADD COLUMN target_live_date DATE"))
            conn.commit()
        except Exception:
            conn.rollback()
    # Migrate: create pre_market_tasks and pending_milestones tables
    Base.metadata.create_all(bind=engine)
    # Migrate: add pending date fields to properties
    pending_cols = [
        ("mutual_date", "DATE"),
        ("inspection_deadline", "DATE"),
        ("inspection_response_received", "BOOLEAN DEFAULT FALSE"),
        ("inspection_response_days", "INTEGER DEFAULT 3"),
        ("inspection_response_date", "DATE"),
        ("earnest_money_date", "DATE"),
        ("closing_date", "DATE"),
    ]
    for col_name, col_type in pending_cols:
        with engine.connect() as conn:
            try:
                conn.execute(text(f"ALTER TABLE properties ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                conn.rollback()
    # Migrate: add category and receipt_url to pre_market_tasks
    for col_name, col_type in [("category", "VARCHAR(50) DEFAULT 'vendor'"), ("receipt_url", "VARCHAR(500)")]:
        with engine.connect() as conn:
            try:
                conn.execute(text(f"ALTER TABLE pre_market_tasks ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                conn.rollback()
    # Migrate: create custom_phase_sections and custom_phase_section_items tables
    Base.metadata.create_all(bind=engine)
    # Create upload directory
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(os.path.join(settings.upload_dir, "photos"), exist_ok=True)
    # Create default admin user if none exists
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == "admin").first()
        if not admin:
            admin_user = User(
                username="stefan",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                full_name="Stefan Wolfe"
            )
            db.add(admin_user)
            # Also create Darius admin
            darius_user = User(
                username="darius",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                full_name="Darius Cincys"
            )
            db.add(darius_user)
            db.commit()
    finally:
        db.close()
    yield

app = FastAPI(title="DC Concierge - Seller Portal", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded photos
os.makedirs("./uploads/photos", exist_ok=True)
@app.get("/health")
async def health_check():
    return {"status": "ok"}

app.mount("/uploads", StaticFiles(directory="./uploads"), name="uploads")


# ─── Auth Routes ──────────────────────────────────────────────────────────────

def build_user_response(user, db):
    """Build user dict with properties for login/invite/reset responses."""
    # Refresh to ensure relationships are loaded
    db.refresh(user)
    properties = []
    for pa in user.property_accesses:
        p = pa.property
        if not p.is_archived:
            properties.append({
                "id": p.id,
                "address": p.address,
                "status": p.status,
                "hero_photo_url": p.hero_photo_url
            })
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "email": user.email,
        "properties": properties
    }

@app.post("/api/auth/login")
async def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)):
    username = request.username.lower().strip()
    # Rate limiting
    check_rate_limit(username)

    user = db.query(User).filter(User.username == username).first()
    # Also check by email for invite-based users
    if not user:
        user = db.query(User).filter(User.email == username).first()

    if not user or not verify_password(request.password, user.hashed_password):
        record_failed_attempt(username)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")

    clear_attempts(username)
    token = create_access_token(data={"sub": user.username, "role": user.role})
    set_auth_cookie(response, token)
    return {"user": build_user_response(user, db)}


@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie("sp_session", path="/")
    return {"message": "Logged out"}


@app.post("/api/auth/invite")
async def send_invite(request: InviteRequest, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    # Verify property exists
    prop = db.query(Property).filter(Property.id == request.property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Check if email already has an account
    existing_user = db.query(User).filter(User.email == request.email.lower()).first()
    if existing_user:
        # Just grant access if they don't already have it
        existing_access = db.query(PropertyAccess).filter(
            PropertyAccess.user_id == existing_user.id,
            PropertyAccess.property_id == request.property_id
        ).first()
        if not existing_access:
            db.add(PropertyAccess(user_id=existing_user.id, property_id=request.property_id))
            db.commit()
        raise HTTPException(status_code=400, detail="This email already has an account. Property access has been granted.")

    # Expire any existing unused invites for this email
    db.query(InviteToken).filter(
        InviteToken.email == request.email.lower(),
        InviteToken.used == False
    ).update({"used": True})

    # Create invite token
    token = secrets.token_urlsafe(48)
    invite = InviteToken(
        token=token,
        email=request.email.lower(),
        full_name=request.full_name,
        property_id=request.property_id,
        expires_at=datetime.utcnow() + timedelta(hours=48)
    )
    db.add(invite)
    db.commit()

    # Send email
    try:
        send_invite_email(request.email, request.full_name, token, prop.address)
    except Exception as e:
        print(f"[INVITE EMAIL ERROR] {e}")
        # Still return success — the invite token is created, admin can share the link manually
        return {
            "message": "Invite created but email failed to send. Share this link manually.",
            "invite_url": f"{settings.portal_url}/accept-invite?token={token}"
        }

    return {"message": f"Invite sent to {request.email}"}


@app.get("/api/auth/validate-token")
async def validate_token(token: str, type: str = "invite", db: Session = Depends(get_db)):
    if type == "invite":
        invite = db.query(InviteToken).filter(
            InviteToken.token == token,
            InviteToken.used == False,
            InviteToken.expires_at > datetime.utcnow()
        ).first()
        if not invite:
            raise HTTPException(status_code=400, detail="Invalid or expired invite link")
        prop = db.query(Property).filter(Property.id == invite.property_id).first()
        return {
            "valid": True,
            "email": invite.email,
            "full_name": invite.full_name,
            "property_address": prop.address if prop else "Your Property"
        }
    elif type == "reset":
        reset = db.query(PasswordResetToken).filter(
            PasswordResetToken.token == token,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > datetime.utcnow()
        ).first()
        if not reset:
            raise HTTPException(status_code=400, detail="Invalid or expired reset link")
        user = db.query(User).filter(User.id == reset.user_id).first()
        return {
            "valid": True,
            "full_name": user.full_name if user else ""
        }
    raise HTTPException(status_code=400, detail="Invalid token type")


@app.post("/api/auth/accept-invite")
async def accept_invite(request: AcceptInviteRequest, response: Response, db: Session = Depends(get_db)):
    invite = db.query(InviteToken).filter(
        InviteToken.token == request.token,
        InviteToken.used == False,
        InviteToken.expires_at > datetime.utcnow()
    ).first()
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or expired invite link")

    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Create the user account with email as username
    user = User(
        username=invite.email,
        hashed_password=get_password_hash(request.password),
        role="client",
        full_name=invite.full_name,
        email=invite.email
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Grant property access
    db.add(PropertyAccess(user_id=user.id, property_id=invite.property_id))

    # Mark invite as used
    invite.used = True
    invite.used_at = datetime.utcnow()
    db.commit()

    # Log them in with a secure cookie
    token = create_access_token(data={"sub": user.username, "role": user.role})
    set_auth_cookie(response, token)
    return {"user": build_user_response(user, db)}


@app.post("/api/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Always return success to prevent email enumeration
    user = db.query(User).filter(User.email == request.email.lower()).first()
    if not user:
        # Also try by username
        user = db.query(User).filter(User.username == request.email.lower()).first()
    if user and user.email:
        # Expire old reset tokens
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False
        ).update({"used": True})

        token = secrets.token_urlsafe(48)
        reset = PasswordResetToken(
            token=token,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        db.add(reset)
        db.commit()

        try:
            send_reset_email(user.email, user.full_name or "there", token)
        except Exception as e:
            print(f"[RESET EMAIL ERROR] {e}")

    return {"message": "If an account exists with that email, a reset link has been sent."}


@app.post("/api/auth/reset-password")
async def reset_password(request: ResetPasswordRequest, response: Response, db: Session = Depends(get_db)):
    reset = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == request.token,
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = db.query(User).filter(User.id == reset.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Account not found")

    user.hashed_password = get_password_hash(request.password)
    reset.used = True
    db.commit()

    # Log them in
    token = create_access_token(data={"sub": user.username, "role": user.role})
    set_auth_cookie(response, token)
    return {"user": build_user_response(user, db)}


@app.get("/api/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    properties = []
    for pa in current_user.property_accesses:
        p = pa.property
        properties.append({
            "id": p.id,
            "address": p.address,
            "status": p.status,
            "hero_photo_url": p.hero_photo_url
        })
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "email": current_user.email,
        "properties": properties
    }


# ─── Property Routes ─────────────────────────────────────────────────────────

@app.get("/api/properties")
async def list_properties(
    status: Optional[str] = None,
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "admin":
        query = db.query(Property)
        if not include_archived:
            query = query.filter((Property.is_archived == False) | (Property.is_archived == None))
        if status:
            if status == "Archived":
                query = db.query(Property).filter(Property.is_archived == True)
            else:
                query = query.filter(Property.status == status)
        properties = query.order_by(Property.created_at.desc()).all()
    else:
        # Client: only show their non-archived properties
        property_ids = [pa.property_id for pa in current_user.property_accesses]
        query = db.query(Property).filter(
            Property.id.in_(property_ids),
            (Property.is_archived == False) | (Property.is_archived == None)
        )
        if status:
            query = query.filter(Property.status == status)
        properties = query.all()

    results = []
    for p in properties:
        # Count activities
        total_showings = db.query(Activity).filter(
            Activity.property_id == p.id,
            Activity.activity_type == "showing",
            Activity.is_pushed == True if current_user.role == "client" else True
        ).count()
        total_open_house = db.query(Activity).filter(
            Activity.property_id == p.id,
            Activity.activity_type == "open_house"
        ).count()
        pending_approval = db.query(Activity).filter(
            Activity.property_id == p.id,
            Activity.is_approved == False
        ).count() if current_user.role == "admin" else 0

        results.append({
            "id": p.id,
            "address": p.address,
            "street_number": p.street_number,
            "city": p.city,
            "state": p.state,
            "zip_code": p.zip_code,
            "mls_number": p.mls_number,
            "list_price": p.list_price,
            "list_date": p.list_date.isoformat() if p.list_date else None,
            "status": p.status,
            "bedrooms": p.bedrooms,
            "bathrooms": p.bathrooms,
            "sqft": p.sqft,
            "description": p.description,
            "hero_photo_url": p.hero_photo_url,
            "gallery_url": p.gallery_url,
            "total_showings": total_showings,
            "total_open_house": total_open_house,
            "pending_approval": pending_approval,
            "created_at": p.created_at.isoformat(),
            "photo_count": len(p.photos),
            "is_archived": p.is_archived or False,
            "phase": p.phase or "active"
        })
    return results

@app.post("/api/properties")
async def create_property(prop: PropertyCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    property_obj = Property(**prop.model_dump())
    db.add(property_obj)
    db.commit()
    db.refresh(property_obj)
    return {"id": property_obj.id, "address": property_obj.address, "message": "Property created"}

@app.get("/api/properties/{property_id}")
async def get_property(property_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Check access for clients
    if current_user.role == "client":
        access = db.query(PropertyAccess).filter(
            PropertyAccess.user_id == current_user.id,
            PropertyAccess.property_id == property_id
        ).first()
        if not access:
            raise HTTPException(status_code=403, detail="Access denied")

    photos = [{"id": ph.id, "url": ph.url, "filename": ph.filename, "is_hero": ph.is_hero, "sort_order": ph.sort_order} for ph in sorted(prop.photos, key=lambda x: x.sort_order)]

    # Calculate days on market
    days_on_market = (date.today() - prop.list_date).days if prop.list_date else 0

    return {
        "id": prop.id,
        "address": prop.address,
        "street_number": prop.street_number,
        "city": prop.city,
        "state": prop.state,
        "zip_code": prop.zip_code,
        "mls_number": prop.mls_number,
        "list_price": prop.list_price,
        "list_date": prop.list_date.isoformat() if prop.list_date else None,
        "status": prop.status,
        "bedrooms": prop.bedrooms,
        "bathrooms": prop.bathrooms,
        "sqft": prop.sqft,
        "description": prop.description,
        "hero_photo_url": prop.hero_photo_url,
        "gallery_url": prop.gallery_url,
        "is_archived": prop.is_archived or False,
        "archived_at": prop.archived_at.isoformat() if prop.archived_at else None,
        "phase": prop.phase or "active",
        "target_live_date": prop.target_live_date.isoformat() if prop.target_live_date else None,
        "mutual_date": prop.mutual_date.isoformat() if prop.mutual_date else None,
        "inspection_deadline": prop.inspection_deadline.isoformat() if prop.inspection_deadline else None,
        "inspection_response_received": prop.inspection_response_received or False,
        "inspection_response_days": prop.inspection_response_days or 3,
        "inspection_response_date": prop.inspection_response_date.isoformat() if prop.inspection_response_date else None,
        "earnest_money_date": prop.earnest_money_date.isoformat() if prop.earnest_money_date else None,
        "closing_date": prop.closing_date.isoformat() if prop.closing_date else None,
        "days_on_market": days_on_market,
        "photos": photos,
        "pre_market_tasks": [{
            "id": t.id,
            "title": t.title, "category": t.category or "vendor",
            "task_type": t.task_type,
            "scheduled_date": t.scheduled_date.isoformat() if t.scheduled_date else None,
            "status": t.status,
            "notes": t.notes, "receipt_url": t.receipt_url,
            "sort_order": t.sort_order
        } for t in sorted(prop.pre_market_tasks, key=lambda x: x.sort_order)],
        "pending_milestones": [{
            "id": m.id,
            "title": m.title,
            "milestone_type": m.milestone_type,
            "due_date": m.due_date.isoformat() if m.due_date else None,
            "status": m.status,
            "notes": m.notes,
            "sort_order": m.sort_order
        } for m in sorted(prop.pending_milestones, key=lambda x: x.sort_order)],
        "custom_sections": [{
            "id": s.id,
            "phase": s.phase,
            "title": s.title,
            "section_type": s.section_type,
            "date_value": s.date_value.isoformat() if s.date_value else None,
            "items": [{"id": i.id, "title": i.title, "status": i.status} for i in sorted(s.items, key=lambda x: x.sort_order)]
        } for s in sorted(prop.custom_sections, key=lambda x: x.sort_order)],
        "vendor_appointments": [{
            "id": v.id, "vendor_name": v.vendor_name, "company": v.company,
            "phone": v.phone, "email": v.email, "service_type": v.service_type,
            "scheduled_date": v.scheduled_date.isoformat() if v.scheduled_date else None,
            "notes": v.notes, "status": v.status
        } for v in sorted(prop.vendor_appointments, key=lambda x: (x.scheduled_date or datetime.max, x.sort_order))]
    }

@app.put("/api/properties/{property_id}")
async def update_property(property_id: int, prop: PropertyUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    db_prop = db.query(Property).filter(Property.id == property_id).first()
    if not db_prop:
        raise HTTPException(status_code=404, detail="Property not found")
    for key, value in prop.model_dump(exclude_unset=True).items():
        setattr(db_prop, key, value)
    db.commit()
    return {"message": "Property updated"}

@app.delete("/api/properties/{property_id}")
async def delete_property(property_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    db_prop = db.query(Property).filter(Property.id == property_id).first()
    if not db_prop:
        raise HTTPException(status_code=404, detail="Property not found")
    # Delete uploaded photo files from disk
    for photo in db_prop.photos:
        file_path = os.path.join(".", photo.url.lstrip("/")) if photo.url else None
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
    # Delete any invite tokens for this property
    db.query(InviteToken).filter(InviteToken.property_id == property_id).delete()
    # Cascade will handle activities, photos, marketing, property_accesses
    db.delete(db_prop)
    db.commit()
    return {"message": "Property and all associated data permanently deleted"}


@app.put("/api/properties/{property_id}/archive")
async def archive_property(property_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    db_prop = db.query(Property).filter(Property.id == property_id).first()
    if not db_prop:
        raise HTTPException(status_code=404, detail="Property not found")
    # Delete hero photo files from disk to save space
    for photo in db_prop.photos:
        file_path = os.path.join(".", photo.url.lstrip("/")) if photo.url else None
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
    # Remove photos from database
    for photo in list(db_prop.photos):
        db.delete(photo)
    # Clear hero photo URL and gallery link
    db_prop.hero_photo_url = None
    db_prop.gallery_url = None
    db_prop.is_archived = True
    db_prop.archived_at = datetime.utcnow()
    db.commit()
    return {"message": "Property archived. Photos and gallery link removed."}


@app.put("/api/properties/{property_id}/unarchive")
async def unarchive_property(property_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    db_prop = db.query(Property).filter(Property.id == property_id).first()
    if not db_prop:
        raise HTTPException(status_code=404, detail="Property not found")
    db_prop.is_archived = False
    db_prop.archived_at = None
    db.commit()
    return {"message": "Property restored. You can re-upload photos and set a gallery URL."}


# ─── Phase Management Routes ─────────────────────────────────────────────────

@app.put("/api/properties/{property_id}/phase")
async def update_phase(property_id: int, phase_data: PhaseUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    db_prop = db.query(Property).filter(Property.id == property_id).first()
    if not db_prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if phase_data.phase not in ("pre_market", "active", "pending"):
        raise HTTPException(status_code=400, detail="Invalid phase.")
    db_prop.phase = phase_data.phase
    # Auto-sync the status badge
    if phase_data.phase == "pre_market":
        db_prop.status = "Coming Soon"
    elif phase_data.phase == "active":
        db_prop.status = "Active"
    elif phase_data.phase == "pending":
        db_prop.status = "Pending"
    if phase_data.target_live_date is not None:
        db_prop.target_live_date = phase_data.target_live_date
    db.commit()
    return {"message": f"Phase updated to {phase_data.phase}", "phase": phase_data.phase, "status": db_prop.status}


@app.put("/api/properties/{property_id}/pending-dates")
async def update_pending_dates(property_id: int, dates: PendingDatesUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    db_prop = db.query(Property).filter(Property.id == property_id).first()
    if not db_prop:
        raise HTTPException(status_code=404, detail="Property not found")
    for key, value in dates.model_dump(exclude_unset=True).items():
        setattr(db_prop, key, value)
    db.commit()
    return {"message": "Pending dates updated"}


@app.put("/api/properties/{property_id}/inspection-toggle")
async def toggle_inspection_response(property_id: int, toggle: InspectionToggle, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    db_prop = db.query(Property).filter(Property.id == property_id).first()
    if not db_prop:
        raise HTTPException(status_code=404, detail="Property not found")
    db_prop.inspection_response_received = toggle.received
    db_prop.inspection_response_days = toggle.response_days
    if toggle.received:
        db_prop.inspection_response_date = (date.today() + timedelta(days=toggle.response_days))
    else:
        db_prop.inspection_response_date = None
    db.commit()
    return {
        "message": "Inspection toggle updated",
        "response_date": db_prop.inspection_response_date.isoformat() if db_prop.inspection_response_date else None
    }


# ─── Custom Section Routes ───────────────────────────────────────────────────

@app.post("/api/properties/{property_id}/custom-sections")
async def create_custom_section(property_id: int, section: CustomSectionCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    max_order = db.query(CustomPhaseSection).filter(CustomPhaseSection.property_id == property_id, CustomPhaseSection.phase == section.phase).count()
    s = CustomPhaseSection(
        property_id=property_id,
        phase=section.phase,
        title=section.title,
        section_type=section.section_type,
        date_value=section.date_value,
        sort_order=max_order
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "message": "Section created"}


@app.put("/api/custom-sections/{section_id}")
async def update_custom_section(section_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db), title: Optional[str] = None, date_value: Optional[date] = None):
    s = db.query(CustomPhaseSection).filter(CustomPhaseSection.id == section_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Section not found")
    if title is not None:
        s.title = title
    if date_value is not None:
        s.date_value = date_value
    db.commit()
    return {"message": "Section updated"}


@app.delete("/api/custom-sections/{section_id}")
async def delete_custom_section(section_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    s = db.query(CustomPhaseSection).filter(CustomPhaseSection.id == section_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Section not found")
    db.delete(s)
    db.commit()
    return {"message": "Section deleted"}


@app.post("/api/custom-sections/{section_id}/items")
async def create_section_item(section_id: int, item: CustomSectionItemCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    max_order = db.query(CustomPhaseSectionItem).filter(CustomPhaseSectionItem.section_id == section_id).count()
    i = CustomPhaseSectionItem(section_id=section_id, title=item.title, sort_order=max_order)
    db.add(i)
    db.commit()
    db.refresh(i)
    return {"id": i.id, "message": "Item created"}


@app.put("/api/custom-section-items/{item_id}")
async def update_section_item(item_id: int, status: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    i = db.query(CustomPhaseSectionItem).filter(CustomPhaseSectionItem.id == item_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Item not found")
    i.status = status
    db.commit()
    return {"message": "Item updated"}


@app.delete("/api/custom-section-items/{item_id}")
async def delete_section_item(item_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    i = db.query(CustomPhaseSectionItem).filter(CustomPhaseSectionItem.id == item_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(i)
    db.commit()
    return {"message": "Item deleted"}


# ─── Pre-Market Task Routes ──────────────────────────────────────────────────

@app.get("/api/properties/{property_id}/tasks")
async def get_tasks(property_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "client":
        access = db.query(PropertyAccess).filter(
            PropertyAccess.user_id == current_user.id,
            PropertyAccess.property_id == property_id
        ).first()
        if not access:
            raise HTTPException(status_code=403, detail="Access denied")
    tasks = db.query(PreMarketTask).filter(PreMarketTask.property_id == property_id).order_by(PreMarketTask.sort_order).all()
    return [{
        "id": t.id,
        "title": t.title, "category": t.category or "vendor",
        "task_type": t.task_type,
        "scheduled_date": t.scheduled_date.isoformat() if t.scheduled_date else None,
        "status": t.status,
        "notes": t.notes, "receipt_url": t.receipt_url,
        "sort_order": t.sort_order
    } for t in tasks]


@app.post("/api/properties/{property_id}/tasks")
async def create_task(property_id: int, task: PreMarketTaskCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    # Get max sort_order
    max_order = db.query(PreMarketTask).filter(PreMarketTask.property_id == property_id, PreMarketTask.category == task.category).count()
    t = PreMarketTask(
        property_id=property_id,
        title=task.title,
        category=task.category,
        task_type=task.task_type,
        scheduled_date=task.scheduled_date,
        status=task.status,
        notes=task.notes,
        sort_order=max_order
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "message": "Task created"}


@app.put("/api/tasks/{task_id}")
async def update_task(task_id: int, task: PreMarketTaskUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    t = db.query(PreMarketTask).filter(PreMarketTask.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in task.model_dump(exclude_unset=True).items():
        setattr(t, key, value)
    if task.status == "complete" and not t.completed_at:
        t.completed_at = datetime.utcnow()
    db.commit()
    return {"message": "Task updated"}


@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    t = db.query(PreMarketTask).filter(PreMarketTask.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(t)
    db.commit()
    return {"message": "Task deleted"}


@app.post("/api/tasks/{task_id}/receipt")
async def upload_receipt(task_id: int, file: UploadFile = File(...), admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    t = db.query(PreMarketTask).filter(PreMarketTask.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    # Save receipt file
    filename = f"receipt_{task_id}_{uuid.uuid4().hex[:8]}_{file.filename}"
    filepath = os.path.join("./uploads/photos", filename)
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    t.receipt_url = f"/uploads/photos/{filename}"
    db.commit()
    return {"receipt_url": t.receipt_url, "message": "Receipt uploaded"}


# ─── Pending Milestone Routes ────────────────────────────────────────────────

@app.get("/api/properties/{property_id}/milestones")
async def get_milestones(property_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "client":
        access = db.query(PropertyAccess).filter(
            PropertyAccess.user_id == current_user.id,
            PropertyAccess.property_id == property_id
        ).first()
        if not access:
            raise HTTPException(status_code=403, detail="Access denied")
    milestones = db.query(PendingMilestone).filter(PendingMilestone.property_id == property_id).order_by(PendingMilestone.sort_order).all()
    return [{
        "id": m.id,
        "title": m.title,
        "milestone_type": m.milestone_type,
        "due_date": m.due_date.isoformat() if m.due_date else None,
        "status": m.status,
        "notes": m.notes,
        "sort_order": m.sort_order
    } for m in milestones]


@app.post("/api/properties/{property_id}/milestones")
async def create_milestone(property_id: int, milestone: PendingMilestoneCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    max_order = db.query(PendingMilestone).filter(PendingMilestone.property_id == property_id).count()
    m = PendingMilestone(
        property_id=property_id,
        title=milestone.title,
        milestone_type=milestone.milestone_type,
        due_date=milestone.due_date,
        status=milestone.status,
        notes=milestone.notes,
        sort_order=max_order
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "message": "Milestone created"}


@app.put("/api/milestones/{milestone_id}")
async def update_milestone(milestone_id: int, milestone: PendingMilestoneUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    m = db.query(PendingMilestone).filter(PendingMilestone.id == milestone_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    for key, value in milestone.model_dump(exclude_unset=True).items():
        setattr(m, key, value)
    if milestone.status == "complete" and not m.completed_at:
        m.completed_at = datetime.utcnow()
    db.commit()
    return {"message": "Milestone updated"}


@app.delete("/api/milestones/{milestone_id}")
async def delete_milestone(milestone_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    m = db.query(PendingMilestone).filter(PendingMilestone.id == milestone_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    db.delete(m)
    db.commit()
    return {"message": "Milestone deleted"}


# ─── Vendor Appointment Routes ───────────────────────────────────────────────

@app.get("/api/properties/{property_id}/vendors")
async def get_vendors(property_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "client":
        access = db.query(PropertyAccess).filter(
            PropertyAccess.user_id == current_user.id,
            PropertyAccess.property_id == property_id
        ).first()
        if not access:
            raise HTTPException(status_code=403, detail="Access denied")
    vendors = db.query(VendorAppointment).filter(
        VendorAppointment.property_id == property_id
    ).order_by(VendorAppointment.scheduled_date.asc().nullslast(), VendorAppointment.sort_order).all()
    return [{
        "id": v.id, "vendor_name": v.vendor_name, "company": v.company,
        "phone": v.phone, "email": v.email, "service_type": v.service_type,
        "scheduled_date": v.scheduled_date.isoformat() if v.scheduled_date else None,
        "notes": v.notes, "status": v.status
    } for v in vendors]


@app.post("/api/properties/{property_id}/vendors")
async def create_vendor(property_id: int, vendor: VendorAppointmentCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    max_order = db.query(VendorAppointment).filter(VendorAppointment.property_id == property_id).count()
    v = VendorAppointment(
        property_id=property_id,
        vendor_name=vendor.vendor_name,
        company=vendor.company,
        phone=vendor.phone,
        email=vendor.email,
        service_type=vendor.service_type,
        scheduled_date=vendor.scheduled_date,
        notes=vendor.notes,
        status=vendor.status,
        sort_order=max_order
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return {"id": v.id, "message": "Vendor appointment created"}


@app.put("/api/vendors/{vendor_id}")
async def update_vendor(vendor_id: int, vendor: VendorAppointmentUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    v = db.query(VendorAppointment).filter(VendorAppointment.id == vendor_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    for key, value in vendor.model_dump(exclude_unset=True).items():
        setattr(v, key, value)
    db.commit()
    return {"message": "Vendor updated"}


@app.delete("/api/vendors/{vendor_id}")
async def delete_vendor(vendor_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    v = db.query(VendorAppointment).filter(VendorAppointment.id == vendor_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    db.delete(v)
    db.commit()
    return {"message": "Vendor deleted"}


# ─── Photo Upload Routes ─────────────────────────────────────────────────────

@app.post("/api/properties/{property_id}/photos")
async def upload_photos(
    property_id: int,
    files: List[UploadFile] = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    photo_dir = os.path.join(settings.upload_dir, "photos", str(property_id))
    os.makedirs(photo_dir, exist_ok=True)

    uploaded = []
    existing_count = db.query(PropertyPhoto).filter(PropertyPhoto.property_id == property_id).count()

    for i, file in enumerate(files):
        ext = os.path.splitext(file.filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(photo_dir, unique_name)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        url = f"/uploads/photos/{property_id}/{unique_name}"
        is_hero = (existing_count == 0 and i == 0)

        photo = PropertyPhoto(
            property_id=property_id,
            filename=file.filename,
            url=url,
            sort_order=existing_count + i,
            is_hero=is_hero
        )
        db.add(photo)
        uploaded.append({"filename": file.filename, "url": url})

        if is_hero:
            prop.hero_photo_url = url
            db.add(prop)

    db.commit()
    return {"uploaded": len(uploaded), "photos": uploaded}

@app.delete("/api/photos/{photo_id}")
async def delete_photo(photo_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    photo = db.query(PropertyPhoto).filter(PropertyPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    # Delete file
    file_path = os.path.join(".", photo.url.lstrip("/"))
    if os.path.exists(file_path):
        os.remove(file_path)
    db.delete(photo)
    db.commit()
    return {"message": "Photo deleted"}


# ─── Activity Routes ──────────────────────────────────────────────────────────

@app.get("/api/activities")
async def list_activities(
    property_id: Optional[int] = None,
    pending_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Activity)

    if current_user.role == "client":
        # Only show pushed activities for client's properties
        property_ids = [pa.property_id for pa in current_user.property_accesses]
        query = query.filter(Activity.property_id.in_(property_ids), Activity.is_pushed == True)
    else:
        if property_id:
            query = query.filter(Activity.property_id == property_id)
        if pending_only:
            query = query.filter(Activity.is_approved == False)

    activities = query.order_by(Activity.activity_date.desc()).all()
    return [{
        "id": a.id,
        "property_id": a.property_id,
        "activity_type": a.activity_type,
        "activity_date": a.activity_date.isoformat(),
        "brokerage": a.brokerage,
        "visitor_count": a.visitor_count,
        "feedback_raw": a.feedback_raw if current_user.role == "admin" else None,
        "feedback_draft": a.feedback_draft if current_user.role == "admin" else None,
        "feedback_approved": a.feedback_approved if a.is_pushed else a.feedback_approved,
        "is_approved": a.is_approved,
        "is_pushed": a.is_pushed,
        "pushed_at": a.pushed_at.isoformat() if a.pushed_at else None,
        "source": a.source,
        "created_at": a.created_at.isoformat()
    } for a in activities]

@app.post("/api/activities")
async def create_activity(activity: ActivityCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    act = Activity(
        property_id=activity.property_id,
        activity_type=activity.activity_type,
        activity_date=activity.activity_date,
        brokerage=activity.brokerage,
        visitor_count=activity.visitor_count,
        feedback_raw=activity.feedback_raw,
        source="manual",
        created_by=admin.username
    )

    # Auto-draft with Alfred if we have feedback and API key
    if activity.feedback_raw and settings.anthropic_api_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            prop = db.query(Property).filter(Property.id == activity.property_id).first()
            prompt = f"""You are Alfred, a professional real estate concierge assistant for the Darius Cincys team. 
Draft a polished, client-friendly feedback summary for a showing/visit at {prop.address if prop else 'the property'}.

Activity type: {activity.activity_type.replace('_', ' ').title()}
Brokerage: {activity.brokerage or 'Not specified'}
Raw feedback: {activity.feedback_raw}

Write a brief, professional 2-3 sentence summary that a homeowner would appreciate reading. 
Focus on positive aspects and constructive observations. Do not include the agent's name, only the brokerage.
Keep it warm but professional."""

            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )
            act.feedback_draft = response.content[0].text
        except Exception as e:
            print(f"Alfred draft failed: {e}")
            act.feedback_draft = activity.feedback_raw

    db.add(act)
    db.commit()
    db.refresh(act)
    return {"id": act.id, "message": "Activity created", "feedback_draft": act.feedback_draft}

@app.put("/api/activities/{activity_id}")
async def update_activity(activity_id: int, update: ActivityUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found")

    if update.feedback_approved is not None:
        act.feedback_approved = update.feedback_approved
    if update.is_approved is not None:
        act.is_approved = update.is_approved
    if update.is_pushed is not None:
        act.is_pushed = update.is_pushed
        if update.is_pushed:
            act.pushed_at = datetime.utcnow()
            if not act.feedback_approved:
                act.feedback_approved = act.feedback_draft or act.feedback_raw

    db.commit()
    return {"message": "Activity updated"}

@app.post("/api/activities/push-batch")
async def push_activities(activity_ids: List[int], admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    count = 0
    for aid in activity_ids:
        act = db.query(Activity).filter(Activity.id == aid).first()
        if act and act.is_approved:
            act.is_pushed = True
            act.pushed_at = datetime.utcnow()
            if not act.feedback_approved:
                act.feedback_approved = act.feedback_draft or act.feedback_raw
            count += 1
    db.commit()
    return {"pushed": count}

@app.delete("/api/activities/{activity_id}")
async def delete_activity(activity_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    act = db.query(Activity).filter(Activity.id == activity_id).first()
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found")
    db.delete(act)
    db.commit()
    return {"message": "Activity deleted"}


# ─── CSV Import Route ─────────────────────────────────────────────────────────

@app.post("/api/activities/import-csv")
async def import_csv(
    property_id: int = Form(...),
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    import csv
    import io

    content = await file.read()
    decoded = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))

    imported = 0
    for row in reader:
        try:
            # Flexible CSV parsing - try common ShowingTime column names
            activity_date_str = row.get("Date") or row.get("Showing Date") or row.get("date") or ""
            brokerage = row.get("Brokerage") or row.get("Buying Office") or row.get("brokerage") or ""
            feedback = row.get("Feedback") or row.get("Agent Feedback") or row.get("Comments") or row.get("feedback") or ""
            activity_type = row.get("Type") or row.get("type") or "showing"

            if activity_date_str:
                # Try multiple date formats
                for fmt in ["%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y", "%m-%d-%Y"]:
                    try:
                        activity_date = datetime.strptime(activity_date_str.strip(), fmt)
                        break
                    except ValueError:
                        continue
                else:
                    activity_date = datetime.utcnow()
            else:
                activity_date = datetime.utcnow()

            act = Activity(
                property_id=property_id,
                activity_type=activity_type.lower().replace(" ", "_"),
                activity_date=activity_date,
                brokerage=brokerage,
                feedback_raw=feedback,
                source="csv_import",
                created_by=admin.username
            )

            # Auto-draft with Alfred
            if feedback and settings.anthropic_api_key:
                try:
                    import anthropic
                    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
                    prop = db.query(Property).filter(Property.id == property_id).first()
                    prompt = f"""Draft a brief, polished client-facing feedback summary for a property showing at {prop.address if prop else 'the property'}.
Brokerage: {brokerage}
Raw feedback: {feedback}
Write 2-3 professional sentences. Focus on positives and constructive points. Only mention the brokerage, not agent names."""
                    response = client.messages.create(
                        model="claude-sonnet-4-20250514",
                        max_tokens=200,
                        messages=[{"role": "user", "content": prompt}]
                    )
                    act.feedback_draft = response.content[0].text
                except Exception:
                    act.feedback_draft = feedback

            db.add(act)
            imported += 1
        except Exception as e:
            print(f"Row import error: {e}")
            continue

    db.commit()
    return {"imported": imported, "message": f"Imported {imported} activities"}


# ─── Marketing Routes ─────────────────────────────────────────────────────────

@app.get("/api/marketing")
async def list_marketing(
    property_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(MarketingItem)
    if current_user.role == "client":
        property_ids = [pa.property_id for pa in current_user.property_accesses]
        query = query.filter(MarketingItem.property_id.in_(property_ids), MarketingItem.is_pushed == True)
    elif property_id:
        query = query.filter(MarketingItem.property_id == property_id)

    items = query.order_by(MarketingItem.completed_date.desc()).all()
    return [{
        "id": m.id,
        "property_id": m.property_id,
        "item_type": m.item_type,
        "title": m.title,
        "description": m.description,
        "url": m.url,
        "completed_date": m.completed_date.isoformat() if m.completed_date else None,
        "is_pushed": m.is_pushed,
        "created_at": m.created_at.isoformat()
    } for m in items]

@app.post("/api/marketing")
async def create_marketing(item: MarketingItemCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    m = MarketingItem(**item.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "message": "Marketing item created"}

@app.put("/api/marketing/{item_id}/push")
async def push_marketing(item_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    m = db.query(MarketingItem).filter(MarketingItem.id == item_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Marketing item not found")
    m.is_pushed = True
    m.pushed_at = datetime.utcnow()
    db.commit()
    return {"message": "Marketing item pushed to client"}


# ─── Client Access Management ────────────────────────────────────────────────

@app.post("/api/property-access")
async def grant_access(access: ClientPropertyAccess, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    existing = db.query(PropertyAccess).filter(
        PropertyAccess.user_id == access.user_id,
        PropertyAccess.property_id == access.property_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Access already granted")
    pa = PropertyAccess(user_id=access.user_id, property_id=access.property_id)
    db.add(pa)
    db.commit()
    return {"message": "Access granted"}

@app.get("/api/clients")
async def list_clients(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    clients = db.query(User).filter(User.role == "client").all()
    return [{
        "id": c.id,
        "username": c.username,
        "full_name": c.full_name,
        "email": c.email,
        "phone": c.phone,
        "is_active": c.is_active,
        "created_at": c.created_at.isoformat(),
        "properties": [{"id": pa.property.id, "address": pa.property.address} for pa in c.property_accesses]
    } for c in clients]


# ─── Dashboard Stats (Client) ────────────────────────────────────────────────

@app.get("/api/dashboard/{property_id}")
async def get_dashboard(property_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Access check for clients
    if current_user.role == "client":
        access = db.query(PropertyAccess).filter(
            PropertyAccess.user_id == current_user.id,
            PropertyAccess.property_id == property_id
        ).first()
        if not access:
            raise HTTPException(status_code=403, detail="Access denied")

    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Only show pushed activities to clients
    activity_filter = Activity.is_pushed == True if current_user.role == "client" else True

    all_activities = db.query(Activity).filter(
        Activity.property_id == property_id,
        activity_filter
    ).order_by(Activity.activity_date.desc()).all()

    # Time calculations
    now = datetime.utcnow()
    week_start = now - timedelta(days=now.weekday())
    month_start = now.replace(day=1)

    def count_by_period(activities, start):
        return len([a for a in activities if a.activity_date >= start])

    def count_by_type(activities):
        counts = {}
        for a in activities:
            t = a.activity_type
            counts[t] = counts.get(t, 0) + (a.visitor_count or 1)
        return counts

    # Breakdown by type for different periods
    this_week = [a for a in all_activities if a.activity_date >= week_start]
    this_month = [a for a in all_activities if a.activity_date >= month_start]

    # Total visitors by type
    total_showings = sum(1 for a in all_activities if a.activity_type == "showing")
    total_open_house_visitors = sum(a.visitor_count or 0 for a in all_activities if a.activity_type == "open_house")

    days_on_market = (date.today() - prop.list_date).days if prop.list_date else 0

    # Weekly activity over time (last 8 weeks)
    weekly_data = []
    for i in range(7, -1, -1):
        week_end = now - timedelta(weeks=i)
        week_begin = week_end - timedelta(weeks=1)
        week_acts = [a for a in all_activities if week_begin <= a.activity_date < week_end]
        weekly_data.append({
            "week": week_begin.strftime("%b %d"),
            "count": len(week_acts),
            "visitors": sum(a.visitor_count or 1 for a in week_acts)
        })

    # Recent activity feed
    recent = [{
        "id": a.id,
        "type": a.activity_type,
        "date": a.activity_date.isoformat(),
        "brokerage": a.brokerage,
        "visitor_count": a.visitor_count,
        "feedback": a.feedback_approved or a.feedback_draft
    } for a in all_activities[:20]]

    return {
        "property": {
            "id": prop.id,
            "address": prop.address,
            "city": prop.city,
            "state": prop.state,
            "list_price": prop.list_price,
            "list_date": prop.list_date.isoformat() if prop.list_date else None,
            "status": prop.status,
            "mls_number": prop.mls_number,
            "days_on_market": days_on_market,
            "hero_photo_url": prop.hero_photo_url,
            "gallery_url": prop.gallery_url,
            "bedrooms": prop.bedrooms,
            "bathrooms": prop.bathrooms,
            "sqft": prop.sqft,
            "phase": prop.phase or "active",
            "target_live_date": prop.target_live_date.isoformat() if prop.target_live_date else None,
            "mutual_date": prop.mutual_date.isoformat() if prop.mutual_date else None,
            "inspection_deadline": prop.inspection_deadline.isoformat() if prop.inspection_deadline else None,
            "inspection_response_received": prop.inspection_response_received or False,
            "inspection_response_days": prop.inspection_response_days or 3,
            "inspection_response_date": prop.inspection_response_date.isoformat() if prop.inspection_response_date else None,
            "earnest_money_date": prop.earnest_money_date.isoformat() if prop.earnest_money_date else None,
            "closing_date": prop.closing_date.isoformat() if prop.closing_date else None,
        },
        "stats": {
            "total_activities": len(all_activities),
            "total_showings": total_showings,
            "total_open_house_visitors": total_open_house_visitors,
            "days_on_market": days_on_market,
            "this_week_count": len(this_week),
            "this_month_count": len(this_month),
        },
        "breakdown": {
            "this_week": count_by_type(this_week),
            "this_month": count_by_type(this_month),
            "all_time": count_by_type(all_activities),
        },
        "weekly_trend": weekly_data,
        "recent_activity": recent,
        "marketing": [{
            "id": m.id,
            "type": m.item_type,
            "title": m.title,
            "description": m.description,
            "url": m.url,
            "date": m.completed_date.isoformat() if m.completed_date else None
        } for m in db.query(MarketingItem).filter(
            MarketingItem.property_id == property_id,
            MarketingItem.is_pushed == True if current_user.role == "client" else True
        ).order_by(MarketingItem.completed_date.desc()).all()],
        "photos": [{
            "id": ph.id,
            "url": ph.url,
            "filename": ph.filename,
            "is_hero": ph.is_hero
        } for ph in sorted(prop.photos, key=lambda x: x.sort_order)],
        "pre_market_tasks": [{
            "id": t.id,
            "title": t.title, "category": t.category or "vendor",
            "task_type": t.task_type,
            "scheduled_date": t.scheduled_date.isoformat() if t.scheduled_date else None,
            "status": t.status,
            "notes": t.notes, "receipt_url": t.receipt_url
        } for t in sorted(prop.pre_market_tasks, key=lambda x: x.sort_order)],
        "pending_milestones": [{
            "id": m.id,
            "title": m.title,
            "milestone_type": m.milestone_type,
            "due_date": m.due_date.isoformat() if m.due_date else None,
            "status": m.status,
            "notes": m.notes
        } for m in sorted(prop.pending_milestones, key=lambda x: x.sort_order)],
        "custom_sections": [{
            "id": s.id,
            "phase": s.phase,
            "title": s.title,
            "section_type": s.section_type,
            "date_value": s.date_value.isoformat() if s.date_value else None,
            "items": [{"id": i.id, "title": i.title, "status": i.status} for i in sorted(s.items, key=lambda x: x.sort_order)]
        } for s in sorted(prop.custom_sections, key=lambda x: x.sort_order)],
        "vendor_appointments": [{
            "id": v.id, "vendor_name": v.vendor_name, "company": v.company,
            "phone": v.phone, "email": v.email, "service_type": v.service_type,
            "scheduled_date": v.scheduled_date.isoformat() if v.scheduled_date else None,
            "notes": v.notes, "status": v.status
        } for v in sorted(prop.vendor_appointments, key=lambda x: (x.scheduled_date or datetime.max, x.sort_order))]
    }


# ─── Serve Frontend in Production ─────────────────────────────────────────────
# When deployed, serve the built React app from /static
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    from starlette.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Try to serve the requested file from static
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # Fall back to index.html for React Router
        return FileResponse(os.path.join(static_dir, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
