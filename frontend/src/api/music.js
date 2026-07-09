import api from './axios';

export const getMusicRecommendation = async (score, tags, genres = []) => {

  const params = {};
  if (score)          params.score  = score;
  if (tags)           params.tags   = tags;
  if (genres?.length) params.genres = genres.join(',');
  const response = await api.get('/api/music/recommend', { params });
  return response.data;

};
