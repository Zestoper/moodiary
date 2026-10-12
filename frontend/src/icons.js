// 이모지 대신 쓰는 lucide 아이콘 모음
import {
  Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudRainWind, Snowflake, CloudSnow, CloudLightning, Thermometer,
  Leaf, BookOpen, Brain, PartyPopper, Smile, Flame,
  Music, Clapperboard, Dumbbell, Footprints, Gamepad2, ChefHat, Palette, MessageCircle, Flower2, Coffee, Car,
  Flower, Moon, Star, Waves, Feather, Clover, Heart, Cat, Sprout, Mountain,
} from 'lucide-react';

// WMO 날씨 코드 → 아이콘
const WEATHER = {
  0: Sun, 1: CloudSun, 2: CloudSun, 3: Cloud,
  45: CloudFog, 48: CloudFog,
  51: CloudDrizzle, 53: CloudDrizzle, 55: CloudDrizzle,
  61: CloudRain, 63: CloudRain, 65: CloudRainWind,
  71: Snowflake, 73: Snowflake, 75: Snowflake, 77: CloudSnow,
  80: CloudDrizzle, 81: CloudDrizzle, 82: CloudRainWind,
  85: CloudSnow, 86: CloudSnow,
  95: CloudLightning, 96: CloudLightning, 99: CloudLightning,
};
export const weatherIcon = (code) => WEATHER[code] || Thermometer;

// AI 채팅 말투
export const PERSONA_ICONS = {
  friend: Leaf, mentor: BookOpen, counselor: Brain, cheerleader: PartyPopper, simsimi: Smile, realist: Flame,
};

// 취향 카테고리
export const HOBBY_ICONS = {
  '음악 듣기': Music,
  '영화/드라마': Clapperboard,
  '운동/스트레칭': Dumbbell,
  '산책/야외활동': Footprints,
  '게임': Gamepad2,
  '요리/베이킹': ChefHat,
  '독서': BookOpen,
  '그림/그리기': Palette,
  '친구/가족과 대화': MessageCircle,
  '혼자만의 시간': Flower2,
  '카페/맛집 탐방': Coffee,
  '드라이브': Car,
};

// 프로필 아바타 (localStorage에는 key 문자열을 저장)
export const AVATAR_ICONS = {
  leaf: Leaf, flower: Flower, cat: Cat, sprout: Sprout, moon: Moon, sun: Sun,
  feather: Feather, waves: Waves, clover: Clover, music: Music, flame: Flame, star: Star,
  heart: Heart, mountain: Mountain,
};
export const avatarIcon = (key) => AVATAR_ICONS[key] || Leaf;
