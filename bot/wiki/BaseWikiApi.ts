import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { objectToQueryString } from '../utilities';
import { baseLogin, getToken as getWikiToken } from './wikiLogin';
import { WikiApiConfig } from '../types';

export const defaultConfig: Partial<WikiApiConfig> = {
  baseUrl: 'https://he.wikipedia.org/w/api.php',
  userName: process.env.USER_NAME,
  password: process.env.PASSWORD,
};

function validateConfig(config: Partial<WikiApiConfig> = defaultConfig): config is WikiApiConfig {
  if (config.userName == null || config.password == null
        || config.baseUrl == null) {
    return false;
  }
  return true;
}

export default function BaseWikiApi(apiConfig: Partial<WikiApiConfig>) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));

  const actualConfig = { ...defaultConfig, ...apiConfig };
  let token: string;
  if (!validateConfig(actualConfig)) {
    throw new Error('Missing username or password');
  }
  const config = actualConfig; // Just for typescript

  async function login() {
    if (token) {
      return token;
    }
    token = await baseLogin(
      config.userName,
      config.password,
      client,
      config.baseUrl,
      config.assertBot,
    );
    return token;
  }

  async function getToken(tokenType = 'login') {
    return getWikiToken(client, config.baseUrl, tokenType);
  }

  async function request(path: string, method?: string, data?: Record<string, any>): Promise<any> {
    if (!token) {
      await login();
    }
    const queryDetails: Record<string, any> = {
      url: config.baseUrl + path,
      method: method ?? 'GET',
    };
    if (data) {
      queryDetails.data = data;
    }
    const result = await client(queryDetails);

    if (result.data.error) {
      console.error(result.data.error);
      throw new Error(`Failed to ${method?.toUpperCase() === 'GET' ? 'get data' : 'perform action'}`);
    } else if (result.data.warnings) {
      console.warn(result.data.warnings);
    }
    return result.data;
  }

  async function* continueQuery(path: string, resultConverterCallback?: (result: any) => any) {
    let result = await request(path);
    while (result.continue) {
      yield resultConverterCallback ? resultConverterCallback(result) : result;
      result = await request(`${path}&${objectToQueryString(result.continue)}`);
    }
    yield resultConverterCallback ? resultConverterCallback(result) : result;
  }

  return {
    login,
    request,
    continueQuery,
    getToken,
  };
}
