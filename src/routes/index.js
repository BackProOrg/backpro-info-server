import api from './api'

export function init(app) {
    app.use('/api', api)
}
