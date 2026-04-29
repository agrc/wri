import { useFirebaseFunctions } from '@ugrc/utah-design-system';
import type { CallableCredentials } from '@ugrc/wri-shared/types';
import { httpsCallable, type HttpsCallable } from 'firebase/functions';
import { getUserCredentials } from '../utils/userCredentials';

export const useTypedCallable = <RequestData, ResponseData>(name: string): HttpsCallable<RequestData, ResponseData> => {
  const { functions } = useFirebaseFunctions();
  functions.region = 'us-west3';

  return httpsCallable<RequestData, ResponseData>(functions, name);
};

export const useCallableData = <RequestData, ResponseData>(
  name: string,
): ((data: RequestData) => Promise<ResponseData>) => {
  const callable = useTypedCallable<RequestData, ResponseData>(name);

  return async (data) => {
    const result = await callable(data);

    return result.data;
  };
};

export const useAuthedCallable = <RequestData extends CallableCredentials, ResponseData>(
  name: string,
): ((data: Omit<RequestData, keyof CallableCredentials>) => Promise<ResponseData>) => {
  const callable = useTypedCallable<RequestData, ResponseData>(name);

  return async (data) => {
    const result = await callable({ ...data, ...getUserCredentials() } as RequestData);

    return result.data;
  };
};
