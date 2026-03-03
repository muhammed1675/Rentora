from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import hmac
import hashlib
import json
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Supabase connection
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

# Create Supabase clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY) if SUPABASE_URL else None
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None

# Create the main app
app = FastAPI(title="Rentora API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)
KORALPAY_SECRET = os.environ.get('KORALPAY_SECRET_KEY', '')
KORALPAY_WEBHOOK_SECRET = os.environ.get('KORALPAY_WEBHOOK_SECRET', '')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
FROM_EMAIL = 'support@rentora.com.ng'
FROM_NAME = 'Rentora'

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============== EMAIL HELPER ==============

async def send_email(to_email: str, subject: str, html: str):
    """Send email via Resend API"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping email")
        return
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": f"{FROM_NAME} <{FROM_EMAIL}>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html
                },
                timeout=10.0
            )
            if response.status_code != 200:
                logger.error(f"Resend error: {response.status_code} {response.text}")
            else:
                logger.info(f"Email sent to {to_email}: {subject}")
    except Exception as e:
        logger.error(f"Email send failed: {e}")

def base_template(content: str) -> str:
    """Wrap content in Rentora branded email template"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {{ margin: 0; padding: 0; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }}
            .wrapper {{ max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
            .header {{ background: #2563eb; padding: 28px 32px; text-align: center; }}
            .header img {{ height: 40px; }}
            .header h1 {{ color: #ffffff; margin: 8px 0 0; font-size: 20px; font-weight: 600; letter-spacing: -0.3px; }}
            .body {{ padding: 32px; }}
            .body h2 {{ color: #111827; font-size: 22px; margin: 0 0 12px; }}
            .body p {{ color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }}
            .card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }}
            .card-row {{ display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }}
            .card-row:last-child {{ border-bottom: none; }}
            .card-row .label {{ color: #6b7280; }}
            .card-row .value {{ color: #111827; font-weight: 600; }}
            .badge {{ display: inline-block; background: #dcfce7; color: #16a34a; border-radius: 999px; padding: 4px 14px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }}
            .badge-blue {{ background: #dbeafe; color: #2563eb; }}
            .btn {{ display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0; }}
            .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; }}
            .footer p {{ color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.8; }}
            .footer a {{ color: #2563eb; text-decoration: none; }}
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="header">
                <h1>🏠 Rentora</h1>
            </div>
            <div class="body">
                {content}
            </div>
            <div class="footer">
                <p>Rentora — Student Housing Made Easy, Ogbomosho</p>
                <p><a href="https://www.rentora.com.ng">www.rentora.com.ng</a> &nbsp;|&nbsp; <a href="mailto:support@rentora.com.ng">support@rentora.com.ng</a></p>
                <p style="margin-top:8px; color:#d1d5db;">You received this email because you have an account on Rentora.</p>
            </div>
        </div>
    </body>
    </html>
    """

# ── Email Templates ──────────────────────────────────────────

def email_welcome(full_name: str) -> str:
    return base_template(f"""
        <span class="badge badge-blue">Welcome to Rentora 🎉</span>
        <h2>Hello, {full_name}!</h2>
        <p>Your account has been created successfully. You can now browse verified student accommodation near LAUTECH, Ogbomosho.</p>
        <p>Here's what you can do:</p>
        <div class="card">
            <div class="card-row"><span class="label">🔍 Browse</span><span class="value">Find verified properties</span></div>
            <div class="card-row"><span class="label">🪙 Tokens</span><span class="value">Buy tokens to unlock contacts</span></div>
            <div class="card-row"><span class="label">📅 Inspect</span><span class="value">Book physical inspections</span></div>
        </div>
        <a href="https://www.rentora.com.ng/browse" class="btn">Browse Properties</a>
        <p>If you have any questions, reply to this email or visit our <a href="https://www.rentora.com.ng/contact">contact page</a>.</p>
    """)

def email_token_receipt(full_name: str, tokens: int, amount: int, new_balance: int, reference: str) -> str:
    formatted_amount = f"₦{amount:,}"
    return base_template(f"""
        <span class="badge">Payment Successful ✓</span>
        <h2>Token Purchase Receipt</h2>
        <p>Hi {full_name}, your token purchase was successful. Your wallet has been credited.</p>
        <div class="card">
            <div class="card-row"><span class="label">Tokens Purchased</span><span class="value">{tokens} token{'s' if tokens > 1 else ''}</span></div>
            <div class="card-row"><span class="label">Amount Paid</span><span class="value">{formatted_amount}</span></div>
            <div class="card-row"><span class="label">New Token Balance</span><span class="value">{new_balance} token{'s' if new_balance != 1 else ''}</span></div>
            <div class="card-row"><span class="label">Reference</span><span class="value" style="font-size:12px">{reference}</span></div>
            <div class="card-row"><span class="label">Date</span><span class="value">{datetime.now().strftime('%d %b %Y, %I:%M %p')}</span></div>
        </div>
        <p>Each token unlocks one property's owner contact details. Start browsing now!</p>
        <a href="https://www.rentora.com.ng/browse" class="btn">Browse Properties</a>
    """)

def email_inspection_booked(full_name: str, property_title: str, inspection_date: str, reference: str, amount: int) -> str:
    formatted_amount = f"₦{amount:,}"
    return base_template(f"""
        <span class="badge">Inspection Confirmed ✓</span>
        <h2>Inspection Booking Confirmed</h2>
        <p>Hi {full_name}, your inspection has been booked and payment received. An agent will be in touch with you before the inspection date.</p>
        <div class="card">
            <div class="card-row"><span class="label">Property</span><span class="value">{property_title}</span></div>
            <div class="card-row"><span class="label">Inspection Date</span><span class="value">{inspection_date}</span></div>
            <div class="card-row"><span class="label">Inspection Fee</span><span class="value">{formatted_amount}</span></div>
            <div class="card-row"><span class="label">Reference</span><span class="value" style="font-size:12px">{reference}</span></div>
            <div class="card-row"><span class="label">Status</span><span class="value">Confirmed — Agent Assigned</span></div>
        </div>
        <p>Please be available on your inspection date. If you need to reschedule, contact us at <a href="mailto:support@rentora.com.ng">support@rentora.com.ng</a>.</p>
        <a href="https://www.rentora.com.ng/profile" class="btn">View My Inspections</a>
    """)

def email_verification_approved(full_name: str) -> str:
    return base_template(f"""
        <span class="badge">Agent Approved ✓</span>
        <h2>Congratulations, {full_name}!</h2>
        <p>Your agent verification has been approved. You are now a verified Rentora agent and can start listing properties.</p>
        <div class="card">
            <div class="card-row"><span class="label">Status</span><span class="value">✅ Verified Agent</span></div>
            <div class="card-row"><span class="label">Can List Properties</span><span class="value">Yes</span></div>
            <div class="card-row"><span class="label">Can Conduct Inspections</span><span class="value">Yes</span></div>
        </div>
        <p>Log in now to start adding your property listings. Make sure all listings are accurate and up to date.</p>
        <a href="https://www.rentora.com.ng/agent" class="btn">Go to Agent Dashboard</a>
        <p>Thank you for joining the Rentora agent network!</p>
    """)

def email_verification_rejected(full_name: str) -> str:
    return base_template(f"""
        <span class="badge" style="background:#fee2e2;color:#dc2626;">Verification Unsuccessful</span>
        <h2>Hi {full_name},</h2>
        <p>Unfortunately, we were unable to approve your agent verification application at this time.</p>
        <p>This may be due to:</p>
        <div class="card">
            <div class="card-row"><span class="label">📄 Documents</span><span class="value">Unclear or incomplete ID/selfie</span></div>
            <div class="card-row"><span class="label">📋 Information</span><span class="value">Details could not be verified</span></div>
        </div>
        <p>You are welcome to reapply with clearer documents. If you believe this is a mistake, please contact us.</p>
        <a href="https://www.rentora.com.ng/become-agent" class="btn" style="background:#6b7280;">Reapply</a>
        &nbsp;&nbsp;
        <a href="mailto:support@rentora.com.ng" class="btn">Contact Support</a>
    """)

# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class AgentVerificationRequest(BaseModel):
    id_card_url: str
    selfie_url: str
    address: str

class PropertyCreate(BaseModel):
    title: str
    description: str
    price: int
    location: str
    property_type: str
    images: List[str]
    contact_name: str
    contact_phone: str

class PropertyUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    location: Optional[str] = None
    property_type: Optional[str] = None
    images: Optional[List[str]] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

class TokenPurchaseRequest(BaseModel):
    quantity: int
    email: str
    phone_number: str

class InspectionRequest(BaseModel):
    property_id: str
    inspection_date: str
    email: str
    phone_number: str

class RoleUpdateRequest(BaseModel):
    user_id: str
    role: str

class SuspendUserRequest(BaseModel):
    user_id: str
    suspended: bool

class ApprovalRequest(BaseModel):
    status: str

class InspectionUpdateRequest(BaseModel):
    status: Optional[str] = None
    agent_id: Optional[str] = None

# ============== HELPERS ==============

def generate_reference(prefix: str) -> str:
    return f"{prefix}-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Verify the JWT token with Supabase
        user_response = supabase.auth.get_user(credentials.credentials)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        supabase_user = user_response.user
        
        # Get user profile from our users table
        result = supabase_admin.table('users').select('*').eq('id', supabase_user.id).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=401, detail="User profile not found")
        
        user = result.data
        if user.get('suspended'):
            raise HTTPException(status_code=403, detail="Account suspended")
        
        return user
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

async def require_role(user: dict, roles: List[str]):
    if user['role'] not in roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register")
async def register(data: UserCreate):
    try:
        # Create user in Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": data.email,
            "password": data.password,
            "options": {
                "data": {
                    "full_name": data.full_name
                }
            }
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Registration failed")
        
        user_id = auth_response.user.id
        
        # Create user profile in users table
        user_profile = {
            "id": user_id,
            "email": data.email,
            "full_name": data.full_name,
            "role": "user",
            "suspended": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        supabase_admin.table('users').insert(user_profile).execute()
        
        # Create wallet for user
        wallet = {
            "user_id": user_id,
            "token_balance": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        supabase_admin.table('wallets').insert(wallet).execute()
        
        # Send welcome email
        await send_email(
            to_email=data.email,
            subject="Welcome to Rentora 🏠",
            html=email_welcome(data.full_name)
        )

        return {
            "token": auth_response.session.access_token if auth_response.session else None,
            "user": {
                "id": user_id,
                "email": data.email,
                "full_name": data.full_name,
                "role": "user",
                "suspended": False
            }
        }
    except Exception as e:
        logger.error(f"Registration error: {e}")
        if "already registered" in str(e).lower():
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/login")
async def login(data: UserLogin):
    try:
        # Sign in with Supabase Auth
        auth_response = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })
        
        if not auth_response.user or not auth_response.session:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Get user profile
        result = supabase_admin.table('users').select('*').eq('id', auth_response.user.id).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=401, detail="User profile not found")
        
        user = result.data
        if user.get('suspended'):
            raise HTTPException(status_code=403, detail="Account suspended")
        
        return {
            "token": auth_response.session.access_token,
            "user": {
                "id": user['id'],
                "email": user['email'],
                "full_name": user['full_name'],
                "role": user['role'],
                "suspended": user['suspended']
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    # Get wallet balance
    wallet_result = supabase_admin.table('wallets').select('token_balance').eq('user_id', user['id']).single().execute()
    token_balance = wallet_result.data.get('token_balance', 0) if wallet_result.data else 0
    
    return {
        "id": user['id'],
        "email": user['email'],
        "full_name": user['full_name'],
        "role": user['role'],
        "suspended": user['suspended'],
        "token_balance": token_balance
    }

# ============== AGENT VERIFICATION ROUTES ==============

@api_router.post("/agent-verification/request")
async def request_agent_verification(data: AgentVerificationRequest, user: dict = Depends(get_current_user)):
    if user['role'] != 'user':
        raise HTTPException(status_code=400, detail="Only regular users can request agent verification")
    
    # Check for existing pending request
    existing = supabase_admin.table('agent_verification_requests').select('id').eq('user_id', user['id']).eq('status', 'pending').execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="You already have a pending verification request")
    
    request_id = str(uuid.uuid4())
    verification = {
        "id": request_id,
        "user_id": user['id'],
        "user_name": user['full_name'],
        "user_email": user['email'],
        "id_card_url": data.id_card_url,
        "selfie_url": data.selfie_url,
        "address": data.address,
        "status": "pending",
        "reviewed_by_admin_id": None,
        "reviewed_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    supabase_admin.table('agent_verification_requests').insert(verification).execute()
    return {"message": "Verification request submitted", "request_id": request_id}

@api_router.get("/agent-verification/my-request")
async def get_my_verification_request(user: dict = Depends(get_current_user)):
    result = supabase_admin.table('agent_verification_requests').select('*').eq('user_id', user['id']).order('created_at', desc=True).limit(1).execute()
    return result.data[0] if result.data else None

@api_router.get("/agent-verification/pending")
async def get_pending_verifications(user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    result = supabase_admin.table('agent_verification_requests').select('*').eq('status', 'pending').execute()
    return result.data

@api_router.get("/agent-verification/all")
async def get_all_verifications(user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    result = supabase_admin.table('agent_verification_requests').select('*').order('created_at', desc=True).execute()
    return result.data

@api_router.post("/agent-verification/{request_id}/review")
async def review_verification(request_id: str, data: ApprovalRequest, user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    
    # Get verification request
    result = supabase_admin.table('agent_verification_requests').select('*').eq('id', request_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Request not found")
    
    verification = result.data
    
    # Update verification status
    supabase_admin.table('agent_verification_requests').update({
        "status": data.status,
        "reviewed_by_admin_id": user['id'],
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }).eq('id', request_id).execute()
    
    # If approved, update user role to agent
    if data.status == "approved":
        supabase_admin.table('users').update({"role": "agent"}).eq('id', verification['user_id']).execute()
        await send_email(
            to_email=verification['user_email'],
            subject="🎉 Your Rentora Agent Verification is Approved!",
            html=email_verification_approved(verification['user_name'])
        )
    elif data.status == "rejected":
        await send_email(
            to_email=verification['user_email'],
            subject="Rentora Agent Verification Update",
            html=email_verification_rejected(verification['user_name'])
        )

    return {"message": f"Verification {data.status}"}

# ============== PROPERTY ROUTES ==============

@api_router.post("/properties")
async def create_property(data: PropertyCreate, user: dict = Depends(get_current_user)):
    await require_role(user, ['agent', 'admin'])
    
    property_id = str(uuid.uuid4())
    property_doc = {
        "id": property_id,
        "title": data.title,
        "description": data.description,
        "price": data.price,
        "location": data.location,
        "property_type": data.property_type,
        "images": data.images,
        "contact_name": data.contact_name,
        "contact_phone": data.contact_phone,
        "uploaded_by_agent_id": user['id'],
        "uploaded_by_agent_name": user['full_name'],
        "status": "pending",
        "approved_by_admin_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    supabase_admin.table('properties').insert(property_doc).execute()
    return {"message": "Property created", "property_id": property_id}

@api_router.get("/properties")
async def get_properties(
    status: Optional[str] = None,
    property_type: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None
):
    query = supabase_admin.table('properties').select('*')
    
    if status:
        query = query.eq('status', status)
    else:
        query = query.eq('status', 'approved')
    
    if property_type:
        query = query.eq('property_type', property_type)
    
    if min_price is not None:
        query = query.gte('price', min_price)
    
    if max_price is not None:
        query = query.lte('price', max_price)
    
    result = query.order('created_at', desc=True).execute()
    return result.data

@api_router.get("/properties/my-listings")
async def get_my_listings(user: dict = Depends(get_current_user)):
    await require_role(user, ['agent', 'admin'])
    result = supabase_admin.table('properties').select('*').eq('uploaded_by_agent_id', user['id']).order('created_at', desc=True).execute()
    return result.data

@api_router.get("/properties/pending")
async def get_pending_properties(user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    result = supabase_admin.table('properties').select('*').eq('status', 'pending').execute()
    return result.data

@api_router.get("/properties/all")
async def get_all_properties(user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    result = supabase_admin.table('properties').select('*').order('created_at', desc=True).execute()
    return result.data

@api_router.get("/properties/{property_id}")
async def get_property(property_id: str, user: dict = Depends(get_current_user)):
    result = supabase_admin.table('properties').select('*').eq('id', property_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    property_doc = result.data
    
    # Check if user has unlocked this property
    unlock_result = supabase_admin.table('unlocks').select('id').eq('user_id', user['id']).eq('property_id', property_id).execute()
    
    response = dict(property_doc)
    response['contact_unlocked'] = len(unlock_result.data) > 0
    
    # Hide contact info if not unlocked (and not agent/admin)
    if not response['contact_unlocked'] and user['role'] == 'user':
        response['contact_phone'] = "***LOCKED***"
    
    return response

@api_router.get("/properties/{property_id}/public")
async def get_property_public(property_id: str):
    result = supabase_admin.table('properties').select('*').eq('id', property_id).eq('status', 'approved').single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    response = dict(result.data)
    response['contact_phone'] = "***LOCKED***"
    response['contact_unlocked'] = False
    return response

@api_router.put("/properties/{property_id}")
async def update_property(property_id: str, data: PropertyUpdate, user: dict = Depends(get_current_user)):
    await require_role(user, ['agent', 'admin'])
    
    result = supabase_admin.table('properties').select('*').eq('id', property_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    property_doc = result.data
    if user['role'] == 'agent' and property_doc['uploaded_by_agent_id'] != user['id']:
        raise HTTPException(status_code=403, detail="Not authorized to edit this property")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        supabase_admin.table('properties').update(update_data).eq('id', property_id).execute()
    
    return {"message": "Property updated"}

@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    
    supabase_admin.table('properties').delete().eq('id', property_id).execute()
    return {"message": "Property deleted"}

@api_router.post("/properties/{property_id}/approve")
async def approve_property(property_id: str, data: ApprovalRequest, user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    
    supabase_admin.table('properties').update({
        "status": data.status,
        "approved_by_admin_id": user['id']
    }).eq('id', property_id).execute()
    
    return {"message": f"Property {data.status}"}

# ============== WALLET & TOKEN ROUTES ==============

@api_router.get("/wallet")
async def get_wallet(user: dict = Depends(get_current_user)):
    result = supabase_admin.table('wallets').select('*').eq('user_id', user['id']).single().execute()
    if not result.data:
        # Create wallet if doesn't exist
        wallet = {
            "user_id": user['id'],
            "token_balance": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        supabase_admin.table('wallets').insert(wallet).execute()
        return wallet
    return result.data

@api_router.get("/wallet/{user_id}")
async def get_user_wallet(user_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    result = supabase_admin.table('wallets').select('*').eq('user_id', user_id).single().execute()
    return result.data

@api_router.post("/tokens/purchase")
async def initiate_token_purchase(data: TokenPurchaseRequest, user: dict = Depends(get_current_user)):
    reference = generate_reference("TOKEN")
    amount = data.quantity * 1000
    
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user['id'],
        "reference": reference,
        "amount": amount,
        "tokens_added": data.quantity,
        "status": "pending",
        "koralpay_reference": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    supabase_admin.table('transactions').insert(transaction).execute()
    
    koralpay_public_key = os.environ.get('KORALPAY_PUBLIC_KEY', 'pk_test_xxx')
    checkout_url = f"https://checkout.korapay.com/checkout?amount={amount}&currency=NGN&reference={reference}&merchant={koralpay_public_key}"
    
    return {
        "reference": reference,
        "amount": amount,
        "quantity": data.quantity,
        "checkout_url": checkout_url,
        "payment_type": "token_purchase"
    }

@api_router.post("/properties/{property_id}/unlock")
async def unlock_property_contact(property_id: str, user: dict = Depends(get_current_user)):
    # Check if already unlocked
    existing = supabase_admin.table('unlocks').select('id').eq('user_id', user['id']).eq('property_id', property_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Already unlocked")
    
    # Check wallet balance
    wallet_result = supabase_admin.table('wallets').select('token_balance').eq('user_id', user['id']).single().execute()
    if not wallet_result.data or wallet_result.data.get('token_balance', 0) < 1:
        raise HTTPException(status_code=400, detail="Insufficient token balance")
    
    # Check property exists
    property_result = supabase_admin.table('properties').select('*').eq('id', property_id).eq('status', 'approved').single().execute()
    if not property_result.data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    property_doc = property_result.data
    
    # Deduct token
    new_balance = wallet_result.data['token_balance'] - 1
    supabase_admin.table('wallets').update({"token_balance": new_balance}).eq('user_id', user['id']).execute()
    
    # Create unlock record
    unlock = {
        "id": str(uuid.uuid4()),
        "user_id": user['id'],
        "property_id": property_id,
        "unlocked_at": datetime.now(timezone.utc).isoformat()
    }
    supabase_admin.table('unlocks').insert(unlock).execute()
    
    return {
        "message": "Contact unlocked",
        "contact_name": property_doc['contact_name'],
        "contact_phone": property_doc['contact_phone']
    }

@api_router.get("/unlocks")
async def get_my_unlocks(user: dict = Depends(get_current_user)):
    unlocks_result = supabase_admin.table('unlocks').select('*').eq('user_id', user['id']).execute()
    
    result = []
    for unlock in unlocks_result.data:
        property_result = supabase_admin.table('properties').select('*').eq('id', unlock['property_id']).single().execute()
        if property_result.data:
            result.append({
                **unlock,
                "property": property_result.data
            })
    
    return result

# ============== INSPECTION ROUTES ==============

@api_router.post("/inspections")
async def request_inspection(data: InspectionRequest, user: dict = Depends(get_current_user)):
    # Check property exists
    property_result = supabase_admin.table('properties').select('*').eq('id', data.property_id).eq('status', 'approved').single().execute()
    if not property_result.data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    property_doc = property_result.data
    reference = generate_reference("INSP")
    inspection_id = str(uuid.uuid4())
    
    inspection = {
        "id": inspection_id,
        "user_id": user['id'],
        "user_name": user['full_name'],
        "user_email": user['email'],
        "property_id": data.property_id,
        "property_title": property_doc['title'],
        "agent_id": property_doc['uploaded_by_agent_id'],
        "agent_name": property_doc.get('uploaded_by_agent_name', ''),
        "inspection_date": data.inspection_date,
        "status": "pending",
        "payment_status": "pending",
        "payment_reference": reference,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    supabase_admin.table('inspections').insert(inspection).execute()
    
    # Create inspection transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "inspection_id": inspection_id,
        "user_id": user['id'],
        "reference": reference,
        "amount": 2000,
        "status": "pending",
        "koralpay_reference": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    supabase_admin.table('inspection_transactions').insert(transaction).execute()
    
    koralpay_public_key = os.environ.get('KORALPAY_PUBLIC_KEY', 'pk_test_xxx')
    checkout_url = f"https://checkout.korapay.com/checkout?amount=2000&currency=NGN&reference={reference}&merchant={koralpay_public_key}"
    
    return {
        "inspection_id": inspection_id,
        "reference": reference,
        "amount": 2000,
        "checkout_url": checkout_url,
        "payment_type": "inspection"
    }

@api_router.get("/inspections")
async def get_my_inspections(user: dict = Depends(get_current_user)):
    result = supabase_admin.table('inspections').select('*').eq('user_id', user['id']).order('created_at', desc=True).execute()
    return result.data

@api_router.get("/inspections/assigned")
async def get_assigned_inspections(user: dict = Depends(get_current_user)):
    await require_role(user, ['agent', 'admin'])
    result = supabase_admin.table('inspections').select('*').eq('agent_id', user['id']).order('created_at', desc=True).execute()
    return result.data

@api_router.get("/inspections/all")
async def get_all_inspections(user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    result = supabase_admin.table('inspections').select('*').order('created_at', desc=True).execute()
    return result.data

@api_router.put("/inspections/{inspection_id}")
async def update_inspection(inspection_id: str, data: InspectionUpdateRequest, user: dict = Depends(get_current_user)):
    result = supabase_admin.table('inspections').select('*').eq('id', inspection_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    inspection = result.data
    
    if user['role'] == 'agent':
        if inspection['agent_id'] != user['id']:
            raise HTTPException(status_code=403, detail="Not authorized")
        if data.status and data.status not in ['completed']:
            raise HTTPException(status_code=403, detail="Agents can only mark as completed")
    
    update_data = {}
    if data.status:
        update_data['status'] = data.status
    if data.agent_id and user['role'] == 'admin':
        agent_result = supabase_admin.table('users').select('full_name').eq('id', data.agent_id).single().execute()
        update_data['agent_id'] = data.agent_id
        update_data['agent_name'] = agent_result.data['full_name'] if agent_result.data else ''
    
    if update_data:
        supabase_admin.table('inspections').update(update_data).eq('id', inspection_id).execute()
    
    return {"message": "Inspection updated"}

@api_router.get("/inspections/{inspection_id}/agent-contact")
async def get_inspection_agent_contact(inspection_id: str, user: dict = Depends(get_current_user)):
    result = supabase_admin.table('inspections').select('*').eq('id', inspection_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    inspection = result.data
    
    if inspection['user_id'] != user['id'] and user['role'] not in ['admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if inspection['payment_status'] != 'completed':
        raise HTTPException(status_code=400, detail="Payment not completed")
    
    agent_result = supabase_admin.table('users').select('full_name, email').eq('id', inspection['agent_id']).single().execute()
    if not agent_result.data:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {
        "agent_name": agent_result.data['full_name'],
        "agent_email": agent_result.data['email']
    }

# ============== TRANSACTION ROUTES ==============

@api_router.get("/transactions")
async def get_my_transactions(user: dict = Depends(get_current_user)):
    token_result = supabase_admin.table('transactions').select('*').eq('user_id', user['id']).order('created_at', desc=True).execute()
    inspection_result = supabase_admin.table('inspection_transactions').select('*').eq('user_id', user['id']).order('created_at', desc=True).execute()
    
    return {
        "token_transactions": token_result.data,
        "inspection_transactions": inspection_result.data
    }

@api_router.get("/transactions/all")
async def get_all_transactions(user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    
    token_result = supabase_admin.table('transactions').select('*').order('created_at', desc=True).execute()
    inspection_result = supabase_admin.table('inspection_transactions').select('*').order('created_at', desc=True).execute()
    
    return {
        "token_transactions": token_result.data,
        "inspection_transactions": inspection_result.data
    }

# ============== USER MANAGEMENT (ADMIN) ==============

@api_router.get("/users")
async def get_all_users(user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    result = supabase_admin.table('users').select('id, email, full_name, role, suspended, created_at').order('created_at', desc=True).execute()
    return result.data

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    result = supabase_admin.table('users').select('id, email, full_name, role, suspended, created_at').eq('id', user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, data: RoleUpdateRequest, user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    
    if data.role not in ['user', 'agent', 'admin']:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    supabase_admin.table('users').update({"role": data.role}).eq('id', user_id).execute()
    return {"message": f"Role updated to {data.role}"}

@api_router.put("/users/{user_id}/suspend")
async def suspend_user(user_id: str, data: SuspendUserRequest, user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    
    supabase_admin.table('users').update({"suspended": data.suspended}).eq('id', user_id).execute()
    return {"message": f"User {'suspended' if data.suspended else 'unsuspended'}"}

# ============== ADMIN DASHBOARD STATS ==============

@api_router.get("/admin/stats")
async def get_admin_stats(user: dict = Depends(get_current_user)):
    await require_role(user, ['admin'])
    
    # Get counts
    users_result = supabase_admin.table('users').select('id', count='exact').execute()
    agents_result = supabase_admin.table('users').select('id', count='exact').eq('role', 'agent').execute()
    properties_result = supabase_admin.table('properties').select('id', count='exact').execute()
    approved_result = supabase_admin.table('properties').select('id', count='exact').eq('status', 'approved').execute()
    pending_props_result = supabase_admin.table('properties').select('id', count='exact').eq('status', 'pending').execute()
    inspections_result = supabase_admin.table('inspections').select('id', count='exact').execute()
    pending_insp_result = supabase_admin.table('inspections').select('id', count='exact').eq('status', 'pending').execute()
    completed_insp_result = supabase_admin.table('inspections').select('id', count='exact').eq('status', 'completed').execute()
    pending_ver_result = supabase_admin.table('agent_verification_requests').select('id', count='exact').eq('status', 'pending').execute()
    
    # Revenue calculations
    token_txs = supabase_admin.table('transactions').select('amount').eq('status', 'completed').execute()
    token_revenue = sum(tx.get('amount', 0) for tx in token_txs.data) if token_txs.data else 0
    
    insp_txs = supabase_admin.table('inspection_transactions').select('amount').eq('status', 'completed').execute()
    inspection_revenue = sum(tx.get('amount', 0) for tx in insp_txs.data) if insp_txs.data else 0
    
    return {
        "total_users": users_result.count or 0,
        "total_agents": agents_result.count or 0,
        "total_properties": properties_result.count or 0,
        "approved_properties": approved_result.count or 0,
        "pending_properties": pending_props_result.count or 0,
        "total_inspections": inspections_result.count or 0,
        "pending_inspections": pending_insp_result.count or 0,
        "completed_inspections": completed_insp_result.count or 0,
        "pending_verifications": pending_ver_result.count or 0,
        "token_revenue": token_revenue,
        "inspection_revenue": inspection_revenue,
        "total_revenue": token_revenue + inspection_revenue
    }

# ============== WEBHOOK HANDLERS ==============

@api_router.post("/webhooks/koralpay")
async def handle_koralpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("x-korapay-signature", "")
    
    # Verify signature (in production)
    if KORALPAY_WEBHOOK_SECRET:
        import base64
        expected_sig = base64.b64encode(
            hmac.new(KORALPAY_WEBHOOK_SECRET.encode(), body, hashlib.sha256).digest()
        ).decode()
        if not hmac.compare_digest(signature, expected_sig):
            logger.warning("Invalid webhook signature")
            raise HTTPException(status_code=401, detail="Invalid signature")
    
    try:
        payload = json.loads(body.decode())
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    event = payload.get("event")
    data = payload.get("data", {})
    reference = data.get("reference", "")
    
    logger.info(f"Webhook received: {event} for {reference}")
    
    if event == "charge.success":
        # Check if token transaction
        token_result = supabase_admin.table('transactions').select('*').eq('reference', reference).single().execute()
        if token_result.data:
            token_tx = token_result.data
            supabase_admin.table('transactions').update({
                "status": "completed",
                "koralpay_reference": data.get("korapay_reference")
            }).eq('reference', reference).execute()
            
            # Add tokens to wallet
            wallet_result = supabase_admin.table('wallets').select('token_balance').eq('user_id', token_tx['user_id']).single().execute()
            new_balance = (wallet_result.data.get('token_balance', 0) if wallet_result.data else 0) + token_tx['tokens_added']
            supabase_admin.table('wallets').update({"token_balance": new_balance}).eq('user_id', token_tx['user_id']).execute()
            logger.info(f"Token purchase completed: {reference}")

            # Send token receipt email
            user_result = supabase_admin.table('users').select('email, full_name').eq('id', token_tx['user_id']).single().execute()
            if user_result.data:
                await send_email(
                    to_email=user_result.data['email'],
                    subject=f"Receipt: {token_tx['tokens_added']} Token{'s' if token_tx['tokens_added'] > 1 else ''} Added to Your Wallet",
                    html=email_token_receipt(
                        full_name=user_result.data['full_name'],
                        tokens=token_tx['tokens_added'],
                        amount=token_tx['amount'],
                        new_balance=new_balance,
                        reference=reference
                    )
                )
        
        # Check if inspection transaction
        insp_result = supabase_admin.table('inspection_transactions').select('*').eq('reference', reference).single().execute()
        if insp_result.data:
            insp_tx = insp_result.data
            supabase_admin.table('inspection_transactions').update({
                "status": "completed",
                "koralpay_reference": data.get("korapay_reference")
            }).eq('reference', reference).execute()
            
            # Update inspection payment status
            supabase_admin.table('inspections').update({
                "payment_status": "completed",
                "status": "assigned"
            }).eq('id', insp_tx['inspection_id']).execute()
            logger.info(f"Inspection payment completed: {reference}")

            # Send inspection confirmation email
            insp_detail = supabase_admin.table('inspections').select('*').eq('id', insp_tx['inspection_id']).single().execute()
            if insp_detail.data:
                insp = insp_detail.data
                await send_email(
                    to_email=insp['user_email'],
                    subject="Inspection Booking Confirmed — Rentora",
                    html=email_inspection_booked(
                        full_name=insp['user_name'],
                        property_title=insp['property_title'],
                        inspection_date=insp['inspection_date'],
                        reference=reference,
                        amount=insp_tx['amount']
                    )
                )
    
    elif event == "charge.failed":
        supabase_admin.table('transactions').update({"status": "failed"}).eq('reference', reference).execute()
        supabase_admin.table('inspection_transactions').update({"status": "failed"}).eq('reference', reference).execute()
    
    return {"status": "success"}

@api_router.post("/payments/verify/{reference}")
async def verify_payment(reference: str, user: dict = Depends(get_current_user)):
    # Check token transaction
    token_result = supabase_admin.table('transactions').select('*').eq('reference', reference).single().execute()
    if token_result.data:
        return {
            "type": "token_purchase",
            "status": token_result.data['status'],
            "amount": token_result.data['amount'],
            "tokens": token_result.data['tokens_added']
        }
    
    # Check inspection transaction
    insp_result = supabase_admin.table('inspection_transactions').select('*').eq('reference', reference).single().execute()
    if insp_result.data:
        return {
            "type": "inspection",
            "status": insp_result.data['status'],
            "amount": insp_result.data['amount']
        }
    
    raise HTTPException(status_code=404, detail="Transaction not found")

# Simulate payment completion (for testing without KoralPay)
@api_router.post("/payments/simulate/{reference}")
async def simulate_payment(reference: str):
    # Check token transaction
    token_result = supabase_admin.table('transactions').select('*').eq('reference', reference).single().execute()
    if token_result.data:
        token_tx = token_result.data
        supabase_admin.table('transactions').update({"status": "completed"}).eq('reference', reference).execute()
        
        # Add tokens to wallet
        wallet_result = supabase_admin.table('wallets').select('token_balance').eq('user_id', token_tx['user_id']).single().execute()
        new_balance = (wallet_result.data.get('token_balance', 0) if wallet_result.data else 0) + token_tx['tokens_added']
        supabase_admin.table('wallets').update({"token_balance": new_balance}).eq('user_id', token_tx['user_id']).execute()
        
        return {"message": "Token payment simulated", "tokens_added": token_tx['tokens_added']}
    
    # Check inspection transaction
    insp_result = supabase_admin.table('inspection_transactions').select('*').eq('reference', reference).single().execute()
    if insp_result.data:
        insp_tx = insp_result.data
        supabase_admin.table('inspection_transactions').update({"status": "completed"}).eq('reference', reference).execute()
        supabase_admin.table('inspections').update({
            "payment_status": "completed",
            "status": "assigned"
        }).eq('id', insp_tx['inspection_id']).execute()
        
        return {"message": "Inspection payment simulated"}
    
    raise HTTPException(status_code=404, detail="Transaction not found")

# ============== STORAGE ROUTES ==============

@api_router.post("/storage/upload-url")
async def get_upload_url(user: dict = Depends(get_current_user)):
    """Get a signed URL for uploading files to Supabase Storage"""
    file_name = f"{user['id']}/{uuid.uuid4().hex}"
    
    # This would be implemented with Supabase Storage
    # For now, return a placeholder response
    return {
        "upload_url": f"{SUPABASE_URL}/storage/v1/object/uploads/{file_name}",
        "file_path": file_name
    }

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Rentora API", "version": "1.0.0", "database": "Supabase"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "supabase_connected": supabase is not None}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
