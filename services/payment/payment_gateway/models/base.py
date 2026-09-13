from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum as SQLEnum
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
from payment_gateway.core.config import settings
from enum import Enum

Base = declarative_base()

# Enum for payment status
class PaymentStatus(str, Enum):
    pending = "pending"
    success = "success"
    failed = "failed"
    cancelled = "cancelled"
    processing = "processing"

# Enum for payment gateway
class PaymentGateway(str, Enum):
    bKash = "bKash"
    Nagad = "Nagad"
    Bank = "Bank"

# Enum for transaction type
class TransactionType(str, Enum):
    purchase = "purchase"
    refund = "refund"
    cashout = "cashout"

# Enum for bank names
class BankName(str, Enum):
    DBBL = "DBBL"
    BRAC = "BRAC"
    CityBank = "CityBank"
    IslamiBank = "IslamiBank"
    StandardChartered = "Standard Chartered"
    HSBC = "HSBC"
    PrimeBank = "Prime Bank"
    EasternBank = "Eastern Bank"
    MercantileBank = "Mercantile Bank"
    TrustBank = "Trust Bank"
    BankAsia = "Bank Asia"

class PaymentSettings:
    """Payment gateway specific settings stored in DB"""
    pass

# Database Models

class Orders(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="BDT")
    status = Column(String, default=PaymentStatus.pending)
    gateway = Column(String, nullable=True)  # bKash, Nagad, Bank
    reference_no = Column(String, nullable=True, unique=True)
    customer_name = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    customer_email = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    idempotency_key = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Transactions(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    gateway = Column(String, nullable=False)  # bKash, Nagad, Bank
    transaction_id = Column(String, unique=True, nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="BDT")
    status = Column(String, default=PaymentStatus.pending)
    response_data = Column(Text, nullable=True)  # JSON string of gateway response
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

class PaymentLogs(Base):
    __tablename__ = "payment_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False, index=True)
    gateway = Column(String, nullable=False)
    request_data = Column(Text, nullable=True)  # JSON string
    response_data = Column(Text, nullable=True)  # JSON string
    status = Column(String, nullable=False)
    error_code = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class BankPayments(Base):
    __tablename__ = "bank_payments"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    bank_name = Column(String, nullable=False)  # DBBL, BRAC, etc.
    account_number = Column(String, nullable=True)
    account_name = Column(String, nullable=True)
    reference_no = Column(String, nullable=True)
    status = Column(String, default=PaymentStatus.pending)
    verified_by = Column(Integer, nullable=True)  # Admin user ID
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class BKashPayments(Base):
    __tablename__ = "bkash_payments"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False, index=True)
    merchant_invoice = Column(String, nullable=True)
    trx_id = Column(String, nullable=True)  # bKash transaction ID
    payment_id = Column(String, nullable=True)  # bKash payment ID
    status = Column(String, default=PaymentStatus.pending)

class NagadPayments(Base):
    __tablename__ = "nagad_payments"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False, index=True)
    merchant_id = Column(String, nullable=True)
    order_id = Column(String, nullable=True)  # External order ID
    payment_ref = Column(String, nullable=True)  # Nagad payment reference
    status = Column(String, default=PaymentStatus.pending)