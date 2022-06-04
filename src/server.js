import express from 'express'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import env from './common/config/'

export const createServer =
    (app) =>
    ({ key, cert }) => {
        return !key || !cert
            ? http.createServer(app)
            : https.createServer({ key, cert }, app)
    }

export const app = () => {
    const app = express()
    let key = null
    let cert = null

    try {
        key = fs.readFileSync(
            path.join(`${env.SSL_DIR_CERTS}`, `${env.CERT_KEY}`)
        )

        cert = fs.readFileSync(
            path.join(`${env.SSL_DIR_CERTS}`, `${env.CERT_NAME}`)
        )
    } catch (err) {
        console.error(err)
    }

    const httpServer = createServer(app)({
        key,
        cert,
    })

    return {
        app,
        httpServer,
    }
}
