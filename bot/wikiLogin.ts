import { AxiosInstance } from 'axios';
import { objectToFormData } from './utilities';

export async function getToken(
  axiosClient: AxiosInstance,
  wikiBaseUrl: string,
  tokenType = 'login',
): Promise<Record<string, string>> {
  const result = await axiosClient(`${wikiBaseUrl}?action=query&meta=tokens&type=${tokenType}&format=json`);
  return result.data.query.tokens;
}

export async function baseLogin(
  userName: string,
  userPassword: string,
  axiosClient: AxiosInstance,
  wikiBaseUrl: string,
): Promise<string> {
  if (!userName || !userPassword) {
    throw new Error('Name and password are required');
  }
  const { logintoken } = await getToken(axiosClient, wikiBaseUrl);

  const result = await axiosClient({
    method: 'post',
    url: wikiBaseUrl,
    data: objectToFormData({
      lgname: userName,
      lgtoken: logintoken,
      lgpassword: userPassword,
      action: 'login',
      format: 'json',
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (result.data.login.result !== 'Success') {
    console.error(result.data.login);
    throw new Error('Failed to login');
  }

  const tokenResult = await axiosClient(`${wikiBaseUrl}?action=query&meta=tokens&format=json&assert=bot`);
  return tokenResult.data.query.tokens.csrftoken;
}
