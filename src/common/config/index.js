import assert from 'assert'
import dotenv from 'dotenv'

dotenv.config()

const {
    NODE_ENV,
    CONNECTION_STRING,
    PORT,
    HOSTNAME,
    CRYPTO_SECRET,
    SSL_DIR_CERTS,
    CERT_NAME,
    CERT_KEY,
} = process.env

assert(NODE_ENV, 'NODE_ENV configuration is required')
assert(CONNECTION_STRING, 'CONNECTION_STRING configuration is required')
assert(PORT, 'PORT configuration is required')
assert(HOSTNAME, 'HOSTNAME configuration is required')
assert(CRYPTO_SECRET, 'CRYPTO_SECRET configuration is required')
assert(SSL_DIR_CERTS, 'SSL_DIR_CERTS config required')
assert(CERT_NAME, 'CERT_NAME config required')
assert(CERT_KEY, 'CERT_KEY config required')

const config = {
    ENV: NODE_ENV,
    PORT: PORT || 8189,
    HOSTNAME: HOSTNAME || 'localhost',
    DATABASE: {
        CONNECTIONSTRING: NODE_ENV === 'test' ? 'AAAAA' : CONNECTION_STRING,
    },
    CRYPTO_SECRET: CRYPTO_SECRET,
    SSL_DIR_CERTS: SSL_DIR_CERTS,
    CERT_NAME: CERT_NAME,
    CERT_KEY: CERT_KEY,
}

export default config
