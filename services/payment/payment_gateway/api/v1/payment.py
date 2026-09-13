"""
Payment Gateway Routes - bKash, Nagad, and Bank Integrations
"""
from fastapi import APIRouter, Depends, HTTPException, Body, Path, Request
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from payment_gateway.core.config import settings
from payment_gateway.core.database import get_db, get_correlation_id
from payment_gateway.models.base import PaymentGateway
from pydantic import BaseModel, Field, validator
import json
import logging
import httpx
import base64
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payment", tags=["payment"])


# --- Pydantic Models ---

class InitiatePayment(BaseModel):
    order_id: Optional[str] = Field(None, description="Existing order ID")
    amount: float = Field(..., gt=0, description="Payment amount in BDT")
    currency: Optional[str] = Field("BDT", description="Currency code")
    customer_name: Optional[str] = Field(None, description="Customer name")
    customer_phone: Optional[str] = Field(None, description="Customer phone number")
    customer_email: Optional[str] = Field(None, description="Customer email")
    return_url: Optional[str] = Field(None, description="URL to redirect after payment")
    cancel_url: Optional[str] = Field(None, description="URL to redirect after cancellation")
    idempotency_key: Optional[str] = Field(None, description="Idempotency key")
    gateway: Optional[str] = Field(None, description="Gateway: bKash, Nagad, Bank")
    reference_no: Optional[str] = Field(None, description="Reference number")

    @validator("idempotency_key", pre=True, always=True)
    def generate_idempotency_key(cls, v):
        if v is None:
            return str(uuid.uuid4())
        return v


class CallbackData(BaseModel):
    status: str
    transaction_id: Optional[str] = None
    reference: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    sender_name: Optional[str] = None
    sender_phone: Optional[str] = None
    transaction_status: Optional[str] = None
    bank_reference: Optional[str] = None


class StatusCheck(BaseModel):
    order_id: str
    gateway: Optional[str] = None


class PaymentMethodsResponse(BaseModel):
    available_gateways: list
    bkash_available: bool
    nagad_available: bool
    bank_available: bool


# --- Database Helpers ---

def save_order(db, **kwargs):
    from ..models.base import Orders
    db_order = Orders(**kwargs)
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


def save_transaction(db, order_id, **kwargs):
    from ..models.base import Transactions
    db_transaction = Transactions(order_id=order_id, **kwargs)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


# --- Gateway Processing Functions ---

async def process_bkash(db, order, payment_data, correlation_id):
    """Process bKash payment"""
    from ..core.config import settings as s
    
    # Get bKash token
    credentials = f"{s.BKASH_USERNAME}:{s.BKASH_PASSWORD}"
    b64_creds = base64.b64encode(credentials.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {b64_creds}",
        "Content-Type": "application/json",
    }
    
    # Step 1: Get access token
    token_url = f"{s.BKASH_BASE_URL}/token/grant"
    try:
        token_response = await httpx.post(token_url, headers=headers, timeout=30)
        token_data = token_response.json()
        access_token = token_data.get("access_token")
    except Exception as e:
        logger.error(f"bKash token error: {e}")
        return {
            "status": "error",
            "message": "bKash gateway error - could not obtain token",
            "payment_id": None,
            "redirect_url": None,
        }
    
    if not access_token:
        return {
            "status": "error",
            "message": "bKash token not obtained",
            "payment_id": None,
            "redirect_url": None,
        }
    
    # Step 2: Create payment session
    payment_url = f"{s.BKASH_BASE_URL}/payment/create"
    payload = {
        "intent": "transfer",
        "transaction_id": order.idempotency_key,
        "amount": str(order.amount),
        "currency": order.currency or "BDT",
        "customer_name": order.customer_name or "",
        "customer_phone": order.customer_phone or "",
        "callback_url": order.return_url or "http://localhost:8000/api/payment/callback",
    }
    
    payment_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    
    try:
        payment_response = await httpx.post(payment_url, json=payload, headers=payment_headers, timeout=30)
        payment_response.raise_for_status()
        payment_data_result = payment_response.json()
    except Exception as e:
        logger.error(f"bKash payment create error: {e}")
        return {
            "status": "error",
            "message": "bKash payment creation failed",
            "payment_id": None,
            "redirect_url": None,
        }
    
    # Step 3: Store transaction and return response
    reference_no = payment_data_result.get("bKashTransId") or payment_data_result.get("payment_id") or str(uuid.uuid4())[:16]
    
    transaction = save_transaction(
        db,
        order_id=order.id,
        gateway=PaymentGateway.bKash,
        transaction_id=payment_data_result.get("bKashTransId"),
        amount=order.amount,
        currency=order.currency or "BDT",
        status=PaymentStatus.pending,
        response_data=json.dumps(payment_data_result),
    )
    
    # Store bKash-specific data
    from ..models.base import BKashPayments
    bkash_payment = BKashPayments(
        transaction_id=transaction.id,
        merchant_invoice=order.idempotency_key,
        trx_id=payment_data_result.get("bKashTransId"),
        payment_id=payment_data_result.get("payment_id"),
        status=PaymentStatus.pending,
    )
    db.add(bkash_payment)
    db.commit()
    
    redirect_url = payment_data_result.get("bank_transfer_url") or payment_data_result.get("payment_url") or ""
    
    return {
        "status": "pending",
        "payment_id": payment_data_result.get("payment_id"),
        "redirect_url": redirect_url,
        "reference": reference_no,
        "message": "bKash payment initiated - redirect customer to complete payment",
    }


async def process_nagad(db, order, payment_data, correlation_id):
    """Process Nagad payment"""
    from ..core.config import settings as s
    
    # Nagad uses RSA signature-based authentication
    # For now, return placeholder - full implementation requires RSA key management
    Nagad_BASE_URL = s.NAGAD_BASE_URL
    
    # Generate signature would require the private key
    # This is a simplified placeholder
    return {
        "status": "pending",
        "payment_id": None,
        "redirect_url": f"{Nagad_BASE_URL}/payment/initiate?amount={order.amount}&currency=BDT",
        "reference": order.idempotency_key or str(uuid.uuid4())[:16],
        "message": "Nagad payment initiation - requires RSA signature implementation",
    }


async def process_bank(db, order, payment_data, correlation_id):
    """Process Bank payment (manual/transfer)"""
    from ..models.base import BankPayments, BankName
    
    bank_name = payment_data.reference_no or "DBBL"  # Default or from reference
    
    # Create bank payment record
    bank_payment = save_transaction(
        db,
        order_id=order.id,
        gateway=PaymentGateway.Bank,
        transaction_id=None,
        amount=order.amount,
        currency=order.currency or "BDT",
        status=PaymentStatus.pending,
        response_data=json.dumps({"bank_name": bank_name, "method": "manual_transfer"}),
    )
    
    # Store bank payment details
    from ..models.base import BankPayments
    bank_rec = BankPayments(
        order_id=order.id,
        bank_name=bank_name,
        account_number=order.customer_phone or "",
        reference_no=order.idempotency_key,
        status=PaymentStatus.pending,
    )
    db.add(bank_rec)
    db.commit()
    
    # For manual bank transfer, provide bank details and wait for verification
    return {
        "status": "pending",
        "payment_id": None,
        "redirect_url": f"/payment/bank/verify?reference={order.idempotency_key}",
        "reference": order.idempotency_key,
        "message": f"Bank transfer initiated - Please transfer {order.amount} BDT to specified account and provide reference",
    }


# --- API Routes ---

@router.post("/initiate", response_model=Dict[str, Any])
async def initiate_payment(
    payment_data: InitiatePayment,
    db: Session = Depends(get_db),
    request: Request = Request,
):
    """
    Initiate payment - Choose gateway (bKash/Nagad/Bank)
    """
    correlation_id = get_correlation_id(request)
    logger.info(f"{correlation_id} - Initiate payment: amount={payment_data.amount}, gateway={payment_data.gateway}")
    
    # Generate idempotency key
    idempotency_key = payment_data.idempotency_key
    
    # Determine gateway
    gateway_name = detect_gateway(payment_data)
    try:
        gateway = PaymentGateway(gateway_name)
    except ValueError:
        gateway = PaymentGateway.bKash  # Default
    
    # Create order
    order = save_order(
        db=db,
        user_id=request.client.host if request.client else 1,
        amount=payment_data.amount,
        currency=payment_data.currency or "BDT",
        status=PaymentStatus.pending,
        gateway=gateway,
        reference_no=payment_data.reference_no,
        customer_name=payment_data.customer_name,
        customer_phone=payment_data.customer_phone,
        customer_email=payment_data.customer_email,
        ip_address=request.client.host if request.client else "unknown",
        idempotency_key=idempotency_key,
    )
    
    # Process based on gateway
    if gateway == PaymentGateway.bKash:
        result = await process_bkash(db, order, payment_data, correlation_id)
    elif gateway == PaymentGateway.Nagad:
        result = await process_nagad(db, order, payment_data, correlation_id)
    elif gateway == PaymentGateway.Bank:
        result = await process_bank(db, order, payment_data, correlation_id)
    else:
        result = await process_bkash(db, order, payment_data, correlation_id)
    
    # Update order status based on result
    if result["status"] == "error":
        # Keep as pending or mark as failed
        pass
    
    return {
        "status": result.get("status", "pending"),
        "data": {
            "payment_id": result.get("payment_id"),
            "gateway": gateway,
            "redirect_url": result.get("redirect_url"),
            "reference": result.get("reference") or order.reference_no,
            "amount": payment_data.amount,
            "currency": payment_data.currency or "BDT",
        },
        "message": result.get("message", "Payment initiated"),
    }


@router.post("/callback", response_model=Dict[str, Any])
async def payment_callback(
    callback_data: CallbackData,
    db: Session = Depends(get_db),
    request: Request = Request,
):
    """
    Handle payment gateway callback
    """
    correlation_id = get_correlation_id(request)
    logger.info(f"{correlation_id} - Payment callback: status={callback_data.status}")
    
    # Find the related transaction
    # This is simplified - in production, match by transaction_id or reference
    transaction = db.query(Transactions).filter(
        Transactions.transaction_id == callback_data.transaction_id
    ).first()
    
    if not transaction:
        # Try to find by order reference
        transaction = db.query(Transactions).filter(
            Transactions.reference_no == callback_data.reference
        ).first()
    
    if not transaction:
        logger.warning(f"{correlation_id} - Could not find transaction for callback")
        return {"status": "error", "message": "Transaction not found"}
    
    # Update transaction status
    old_status = transaction.status
    transaction.status = callback_data.status
    transaction.response_data = json.dumps({
        "gateway_status": callback_data.status,
        "transaction_id": callback_data.transaction_id,
        "reference": callback_data.reference,
        **callback_data.dict(exclude={"status", "transaction_id", "reference"}),
    })
    transaction.completed_at = func.now() if callback_data.status in ["success", "failed", "cancelled"] else None
    db.commit()
    
    # Update related bKash/Nagad payment records
    gateway = PaymentGateway(transaction.gateway)
    
    try:
        if gateway == PaymentGateway.bKash:
            from ..models.base import BKashPayments
            bkash_txn = db.query(BKashPayments).filter(
                BKashPayments.transaction_id == transaction.id
            ).first()
            if bkash_txn:
                bkash_txn.status = callback_data.status
                db.commit()
        
        elif gateway == PaymentGateway.Nagad:
            from ..models.base import NagadPayments
            nagad_txn = db.query(NagadPayments).filter(
                NagadPayments.transaction_id == transaction.id
            ).first()
            if nagad_txn:
                nagad_txn.status = callback_data.status
                db.commit()
    
    except Exception as e:
        logger.error(f"Error updating payment records: {e}")
    
    return {
        "status": "success",
        "message": f"Payment callback processed: {callback_data.status}",
        "transaction_id": transaction.id,
    }


@router.get("/status/{order_id}", response_model=Dict[str, Any])
async def check_payment_status(
    order_id: str,
    db: Session = Depends(get_db),
):
    """
    Check payment status by order ID
    """
    # Try to find by order ID (as integer) or reference
    try:
        order_id_int = int(order_id)
        transaction = db.query(Transactions).filter(Transactions.order_id == order_id_int).first()
    except ValueError:
        transaction = db.query(Transactions).filter(
            Transactions.reference_no == order_id
        ).first()
    
    if not transaction:
        return {
            "status": "error",
            "message": "Payment not found",
            "data": {
                "payment_id": None,
                "gateway": None,
                "status": PaymentStatus.pending,
                "reference": None,
                "amount": 0,
                "currency": "BDT",
            },
        }
    
    # Get gateway-specific data
    gateway = PaymentGateway(transaction.gateway)
    
    response_data = json.loads(transaction.response_data) if transaction.response_data else {}
    
    return {
        "status": "success",
        "data": {
            "payment_id": transaction.transaction_id,
            "gateway": transaction.gateway,
            "status": transaction.status,
            "reference": transaction.reference_no,
            "amount": transaction.amount,
            "currency": transaction.currency or "BDT",
            "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
            "completed_at": transaction.completed_at.isoformat() if transaction.completed_at else None,
            "response_data": response_data,
        },
        "message": "Payment status retrieved",
    }


@router.get("/methods", response_model=PaymentMethodsResponse)
async def list_payment_methods():
    """List available payment methods"""
    return PaymentMethodsResponse(
        available_gateways=["bKash", "Nagad", "Bank"],
        bkash_available=True,
        nagad_available=True,
        bank_available=True,
    )


@router.post("/bank/verify")
async def verify_bank_payment(
    reference: str = Body(...),
    db: Session = Depends(get_db),
    current_user: int = Body(...),  # Admin user ID
):
    """
    Manual bank payment verification (Admin)
    """
    # Find the bank payment record
    bank_payment = db.query(BankPayments).filter(
        BankPayments.reference_no == reference
    ).first()
    
    if not bank_payment:
        raise HTTPException(status_code=404, detail="Bank payment not found")
    
    # Update status to verified
    bank_payment.status = PaymentStatus.success
    bank_payment.verified_by = current_user
    bank_payment.verified_at = func.now()
    
    # Update related transaction
    transaction = db.query(Transactions).filter(
        Transactions.order_id == bank_payment.order_id
    ).first()
    
    if transaction:
        transaction.status = PaymentStatus.success
        transaction.response_data = json.dumps({
            "verified_by": current_user,
            "verified_at": func.now(),
            "method": "admin_manual_verification",
        })
        transaction.completed_at = func.now()
    
    db.commit()
    
    return {
        "status": "success",
        "message": f"Bank payment {reference} verified successfully",
        "verified_at": bank_payment.verified_at,
        "verified_by": current_user,
    }