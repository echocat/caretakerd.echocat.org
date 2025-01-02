import {ExecutionContext} from '@cloudflare/workers-types';
import {Environment} from './common';
import {Router} from './router';

const testEnvironment: Environment = {
    __STATIC_CONTENT: {},
    GITHUB_ACCESS_USER: 'testGithubAccessUser',
    GITHUB_ACCESS_TOKEN: 'testGithubAccessToken',
    CACHE: {
        put() {
            throw `Not implemented!`;
        },
        get() {
            throw `Not implemented!`;
        },
        list() {
            throw `Not implemented!`;
        },
        delete() {
            throw `Not implemented!`;
        },
        // @ts-ignore
        getWithMetadataetadata() {
            throw `Not implemented!`;
        },
    },
};

const testContext: ExecutionContext = {
    waitUntil() {
        throw `Not implemented!`;
    },
    passThroughOnException() {
        throw `Not implemented!`;
    },
    props: {},
};

test('GET /', async () => {
    const router = new Router({});
    const result = await router.handle(new Request('http://falcon/all', {method: 'GET'}), testEnvironment, testContext);
    expect(result.status).toBe(301);
});
