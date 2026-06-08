import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { DeepSearchInput, HealthStatus, ListRecentSearchesParams, NameSearchInput, PhoneSearchInput, PlatformInfo, PlatformStats, SearchResult, SearchSummary, SearchTask, UsernameSearchInput } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getSearchByNameUrl: () => string;
/**
 * Search for a person by Libyan name (Arabic or English)
 * @summary Search by name
 */
export declare const searchByName: (nameSearchInput: NameSearchInput, options?: RequestInit) => Promise<SearchTask>;
export declare const getSearchByNameMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof searchByName>>, TError, {
        data: BodyType<NameSearchInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof searchByName>>, TError, {
    data: BodyType<NameSearchInput>;
}, TContext>;
export type SearchByNameMutationResult = NonNullable<Awaited<ReturnType<typeof searchByName>>>;
export type SearchByNameMutationBody = BodyType<NameSearchInput>;
export type SearchByNameMutationError = ErrorType<void>;
/**
* @summary Search by name
*/
export declare const useSearchByName: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof searchByName>>, TError, {
        data: BodyType<NameSearchInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof searchByName>>, TError, {
    data: BodyType<NameSearchInput>;
}, TContext>;
export declare const getSearchByPhoneUrl: () => string;
/**
 * Search for information about a Libyan phone number (+218)
 * @summary Search by phone number
 */
export declare const searchByPhone: (phoneSearchInput: PhoneSearchInput, options?: RequestInit) => Promise<SearchTask>;
export declare const getSearchByPhoneMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof searchByPhone>>, TError, {
        data: BodyType<PhoneSearchInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof searchByPhone>>, TError, {
    data: BodyType<PhoneSearchInput>;
}, TContext>;
export type SearchByPhoneMutationResult = NonNullable<Awaited<ReturnType<typeof searchByPhone>>>;
export type SearchByPhoneMutationBody = BodyType<PhoneSearchInput>;
export type SearchByPhoneMutationError = ErrorType<void>;
/**
* @summary Search by phone number
*/
export declare const useSearchByPhone: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof searchByPhone>>, TError, {
        data: BodyType<PhoneSearchInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof searchByPhone>>, TError, {
    data: BodyType<PhoneSearchInput>;
}, TContext>;
export declare const getSearchByUsernameUrl: () => string;
/**
 * Search for a username across 400+ platforms including Libya-specific platforms
 * @summary Search by username
 */
export declare const searchByUsername: (usernameSearchInput: UsernameSearchInput, options?: RequestInit) => Promise<SearchTask>;
export declare const getSearchByUsernameMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof searchByUsername>>, TError, {
        data: BodyType<UsernameSearchInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof searchByUsername>>, TError, {
    data: BodyType<UsernameSearchInput>;
}, TContext>;
export type SearchByUsernameMutationResult = NonNullable<Awaited<ReturnType<typeof searchByUsername>>>;
export type SearchByUsernameMutationBody = BodyType<UsernameSearchInput>;
export type SearchByUsernameMutationError = ErrorType<void>;
/**
* @summary Search by username
*/
export declare const useSearchByUsername: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof searchByUsername>>, TError, {
        data: BodyType<UsernameSearchInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof searchByUsername>>, TError, {
    data: BodyType<UsernameSearchInput>;
}, TContext>;
export declare const getDeepSearchUrl: () => string;
/**
 * Run all three search modes at once from a single query
 * @summary Deep search all modes simultaneously
 */
export declare const deepSearch: (deepSearchInput: DeepSearchInput, options?: RequestInit) => Promise<SearchTask>;
export declare const getDeepSearchMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deepSearch>>, TError, {
        data: BodyType<DeepSearchInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deepSearch>>, TError, {
    data: BodyType<DeepSearchInput>;
}, TContext>;
export type DeepSearchMutationResult = NonNullable<Awaited<ReturnType<typeof deepSearch>>>;
export type DeepSearchMutationBody = BodyType<DeepSearchInput>;
export type DeepSearchMutationError = ErrorType<unknown>;
/**
* @summary Deep search all modes simultaneously
*/
export declare const useDeepSearch: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deepSearch>>, TError, {
        data: BodyType<DeepSearchInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deepSearch>>, TError, {
    data: BodyType<DeepSearchInput>;
}, TContext>;
export declare const getGetSearchResultUrl: (id: string) => string;
/**
 * Retrieve the full result of a completed search task
 * @summary Get search result
 */
export declare const getSearchResult: (id: string, options?: RequestInit) => Promise<SearchResult>;
export declare const getGetSearchResultQueryKey: (id: string) => readonly [`/api/search/${string}`];
export declare const getGetSearchResultQueryOptions: <TData = Awaited<ReturnType<typeof getSearchResult>>, TError = ErrorType<void>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSearchResult>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getSearchResult>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetSearchResultQueryResult = NonNullable<Awaited<ReturnType<typeof getSearchResult>>>;
export type GetSearchResultQueryError = ErrorType<void>;
/**
 * @summary Get search result
 */
export declare function useGetSearchResult<TData = Awaited<ReturnType<typeof getSearchResult>>, TError = ErrorType<void>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSearchResult>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetSearchStatusUrl: (id: string) => string;
/**
 * Poll the status of an ongoing search task
 * @summary Get search task status
 */
export declare const getSearchStatus: (id: string, options?: RequestInit) => Promise<SearchTask>;
export declare const getGetSearchStatusQueryKey: (id: string) => readonly [`/api/search/${string}/status`];
export declare const getGetSearchStatusQueryOptions: <TData = Awaited<ReturnType<typeof getSearchStatus>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSearchStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getSearchStatus>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetSearchStatusQueryResult = NonNullable<Awaited<ReturnType<typeof getSearchStatus>>>;
export type GetSearchStatusQueryError = ErrorType<unknown>;
/**
 * @summary Get search task status
 */
export declare function useGetSearchStatus<TData = Awaited<ReturnType<typeof getSearchStatus>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSearchStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListRecentSearchesUrl: (params?: ListRecentSearchesParams) => string;
/**
 * Returns the most recent completed investigation sessions
 * @summary List recent searches
 */
export declare const listRecentSearches: (params?: ListRecentSearchesParams, options?: RequestInit) => Promise<SearchSummary[]>;
export declare const getListRecentSearchesQueryKey: (params?: ListRecentSearchesParams) => readonly ["/api/searches/recent", ...ListRecentSearchesParams[]];
export declare const getListRecentSearchesQueryOptions: <TData = Awaited<ReturnType<typeof listRecentSearches>>, TError = ErrorType<unknown>>(params?: ListRecentSearchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listRecentSearches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listRecentSearches>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListRecentSearchesQueryResult = NonNullable<Awaited<ReturnType<typeof listRecentSearches>>>;
export type ListRecentSearchesQueryError = ErrorType<unknown>;
/**
 * @summary List recent searches
 */
export declare function useListRecentSearches<TData = Awaited<ReturnType<typeof listRecentSearches>>, TError = ErrorType<unknown>>(params?: ListRecentSearchesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listRecentSearches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetStatsUrl: () => string;
/**
 * Returns aggregate statistics for the LYOSINT platform
 * @summary Get platform statistics
 */
export declare const getStats: (options?: RequestInit) => Promise<PlatformStats>;
export declare const getGetStatsQueryKey: () => readonly ["/api/stats"];
export declare const getGetStatsQueryOptions: <TData = Awaited<ReturnType<typeof getStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getStats>>>;
export type GetStatsQueryError = ErrorType<unknown>;
/**
 * @summary Get platform statistics
 */
export declare function useGetStats<TData = Awaited<ReturnType<typeof getStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPlatformCoverageUrl: () => string;
/**
 * Returns the list of all platforms searched and their status
 * @summary Get platform coverage list
 */
export declare const getPlatformCoverage: (options?: RequestInit) => Promise<PlatformInfo[]>;
export declare const getGetPlatformCoverageQueryKey: () => readonly ["/api/platform-coverage"];
export declare const getGetPlatformCoverageQueryOptions: <TData = Awaited<ReturnType<typeof getPlatformCoverage>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlatformCoverage>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPlatformCoverage>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPlatformCoverageQueryResult = NonNullable<Awaited<ReturnType<typeof getPlatformCoverage>>>;
export type GetPlatformCoverageQueryError = ErrorType<unknown>;
/**
 * @summary Get platform coverage list
 */
export declare function useGetPlatformCoverage<TData = Awaited<ReturnType<typeof getPlatformCoverage>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlatformCoverage>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map