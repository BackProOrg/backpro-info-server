import * as application from './src/server'
import config from './src/common/config/'
import cors from 'cors'
import express from 'express'
import * as routes from './src/routes/'

const { app, httpServer } = application.app()

function server(config, app, httpServer) {
    // app settings
    app.set('env', config.ENV)
    app.set('PORT', config.PORT)
    app.set('hostname', config.HOSTNAME)
    app.set('trust proxy', true)
    app.use(cors({ origin: true }))
    app.use(express.json())
    app.use(
        express.urlencoded({
            extended: true,
        })
    )

    routes.init(app)

    httpServer.listen(config.PORT, () =>
        console.log('listening on PORT ' + config.PORT)
    )

    return app
}

const servidor = server(config, app, httpServer)
