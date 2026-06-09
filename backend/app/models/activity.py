from sqlalchemy import Column, String, Integer, Float, Text, DateTime, Boolean, ForeignKey, JSON, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class Activity(Base):
    __tablename__ = "activities"

    id = Column(String, primary_key=True)
    google_place_id = Column(String, unique=True, nullable=True)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)  # 'evergreen' | 'event'
    canton = Column(String, nullable=False)  # 'GE' | 'VD' | 'FR' | 'VS' | 'JU'
    address = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    opening_hours = Column(JSON, nullable=True)
    photo_path = Column(String, nullable=True)  # local path relative to uploads/
    maps_url = Column(String, nullable=True)
    website = Column(String, nullable=True)
    tags = Column(JSON, default=list)
    duration_hint = Column(String, nullable=True)
    date_from = Column(DateTime, nullable=True)
    date_to = Column(DateTime, nullable=True)
    source_url = Column(String, nullable=True)
    last_scraped_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    prefs = relationship("Pref", back_populates="activity")


class Pref(Base):
    __tablename__ = "prefs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, nullable=False)
    activity_id = Column(String, ForeignKey("activities.id"), nullable=False)
    score = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    activity = relationship("Activity", back_populates="prefs")

    __table_args__ = (
        UniqueConstraint("session_id", "activity_id", name="uq_session_activity"),
        Index("ix_prefs_session_activity", "session_id", "activity_id"),
    )


class Basket(Base):
    __tablename__ = "baskets"

    id = Column(String, primary_key=True)
    session_id = Column(String, nullable=False, index=True)
    date_from = Column(DateTime, nullable=False)
    date_to = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    archived = Column(Boolean, default=False)

    activities = relationship("BasketActivity", back_populates="basket")


class BasketActivity(Base):
    __tablename__ = "basket_activities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    basket_id = Column(String, ForeignKey("baskets.id"), nullable=False)
    activity_id = Column(String, ForeignKey("activities.id"), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)

    basket = relationship("Basket", back_populates="activities")
    activity = relationship("Activity")