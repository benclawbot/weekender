from pydantic import BaseModel
from typing import Optional


class OpeningHoursSchema(BaseModel):
    mon: Optional[str] = None
    tue: Optional[str] = None
    wed: Optional[str] = None
    thu: Optional[str] = None
    fri: Optional[str] = None
    sat: Optional[str] = None
    sun: Optional[str] = None


class ActivityBase(BaseModel):
    id: str
    title: str
    type: str
    canton: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    opening_hours: Optional[OpeningHoursSchema] = None
    photo_url: Optional[str] = None
    maps_url: Optional[str] = None
    website: Optional[str] = None
    tags: list[str] = []
    duration_hint: Optional[str] = None
    pref_score: int = 0
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    source_url: Optional[str] = None


class ActivityResponse(ActivityBase):
    pass


class PrefCreate(BaseModel):
    activity_id: str
    direction: str  # 'yes' | 'up' | 'no'
    session_id: str


class PrefResponse(BaseModel):
    activity_id: str
    score: int


class BasketCreate(BaseModel):
    session_id: str
    date_from: str
    date_to: str
    activity_ids: list[str]


class BasketActivitySchema(BaseModel):
    id: str
    title: str
    type: str
    canton: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    photo_url: Optional[str] = None
    maps_url: Optional[str] = None
    website: Optional[str] = None
    tags: list[str] = []
    duration_hint: Optional[str] = None
    pref_score: int = 0


class BasketResponse(BaseModel):
    id: str
    session_id: str
    date_from: str
    date_to: str
    activities: list[BasketActivitySchema]
    created_at: str