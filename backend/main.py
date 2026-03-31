import os
import json
import uuid
import shutil
from datetime import datetime, timedelta, date
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Relationships
    photos = relationship("PropertyPhoto", back_populates="property", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="property", cascade="all, delete-orphan")
    marketing_items = relationship("MarketingItem", back_populates="property", cascade="all, delete-orphan")
    property_accesses = relationship("PropertyAccess", back_populates="property", cascade="all, delete-orphan")


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


# ─── Auth ─────────────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
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


# ─── App ──────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
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
app.mount("/uploads", StaticFiles(directory="./uploads"), name="uploads")


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.post("/api/auth/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username.lower()).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")
    token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "email": user.email
        }
    }

@app.post("/api/auth/signup")
async def client_signup(request: ClientSignup, db: Session = Depends(get_db)):
    # Check if username already exists
    existing = db.query(User).filter(User.username == request.username.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    user = User(
        username=request.username.lower(),
        hashed_password=get_password_hash(request.password),
        role="client",
        full_name=request.full_name,
        email=request.email,
        phone=request.phone
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role
        }
    }

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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "admin":
        query = db.query(Property)
        if status:
            query = query.filter(Property.status == status)
        properties = query.order_by(Property.created_at.desc()).all()
    else:
        # Client: only show their properties
        property_ids = [pa.property_id for pa in current_user.property_accesses]
        query = db.query(Property).filter(Property.id.in_(property_ids))
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
            "total_showings": total_showings,
            "total_open_house": total_open_house,
            "pending_approval": pending_approval,
            "created_at": p.created_at.isoformat(),
            "photo_count": len(p.photos)
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
        "days_on_market": days_on_market,
        "photos": photos
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
    db.delete(db_prop)
    db.commit()
    return {"message": "Property deleted"}


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
            "bedrooms": prop.bedrooms,
            "bathrooms": prop.bathrooms,
            "sqft": prop.sqft,
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
        } for ph in sorted(prop.photos, key=lambda x: x.sort_order)]
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
