// ─── 음악 추천 API (Spotify) ──────────────────────────────────────────────────────

import api from './axios';

export const getMusicRecommendation = async (score, tags, genres = []) => {
  // score: 1~5 감정 점수, tags: "기쁨,설렘" 형태, genres: ["재즈","발라드"] 배열
  const params = {};
  if (score)          params.score  = score;
  if (tags)           params.tags   = tags;
  if (genres?.length) params.genres = genres.join(',');
  const response = await api.get('/api/music/recommend', { params });
  return response.data;
  // 반환값: { playlists: [{id, name, image, url}], configured: true/false }
};
