import _ from 'lodash';
import hera from '../utils/hera';
import { ajvs } from 'ajvs-ts';

const ajv = ajvs();

export interface ENV_CONFIG {
    NAME: string;
    HTTP_PORT: number;
    LOG_LEVEL: string;
}

const ajvEnvConfig = ajv.compile({
    '+@NAME': 'string',
    '@HTTP_PORT': 'number',
    '@LOG_LEVEL': 'string'
})

const ENV_DEFAULT: Partial<ENV_CONFIG> = {
    HTTP_PORT: 3000,
    LOG_LEVEL: 'debug'
}

const envCustomParser = {
    HTTP_PORT: hera.parseInt
}

function loadConfig(): ENV_CONFIG {
    console.debug('process.env')
    console.debug(JSON.stringify(process.env, null, 2))
    const config: Partial<ENV_CONFIG> = _.cloneDeep(ENV_DEFAULT);
    for (const key in process.env) {
        let val = process.env[key]
        if (envCustomParser[key]) {
            val = envCustomParser[key](val)
        }
        _.set(config, key, val);
    }

    if (!ajvEnvConfig(config)) throw new Error(`Invalid env config; ${JSON.stringify(ajvEnvConfig.errors, null, 2)}`)
    return config as ENV_CONFIG;
}

export const ENV: ENV_CONFIG = loadConfig();
export default ENV;