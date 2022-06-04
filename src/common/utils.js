import jwt from 'jsonwebtoken'
import config from '../common/config'
const { CRYPTO_SECRET } = config

export async function isAuthenticated(req, res, next) {
    try {
        const token = req.headers.token
        const decoded = jwt.verify(token, CRYPTO_SECRET)
        req.decodedUser = decoded
        next()
    } catch (err) {
        res.status(401).json({
            msg: 'Tu sesión no es válida :/',
            err: err.name,
        })
    }
}

export function mergeConfigCartera(configs) {
    if (!configs) {
        return null
    }

    const newConfig = {
        idAsesor: '',
        diasConfig: [],
    }

    configs.forEach((config) => {
        let i = 0

        const isDiasAdded = newConfig.diasConfig.find((e, index) => {
            i = index
            return (
                e.idDiasProceso === config.id_dias_proceso &&
                e.dias === config.dias
            )
        })

        if (!isDiasAdded) {
            const mail =
                config.id_tipo_notificacion === 1
                    ? {
                          state: true,
                          idTipoNotificacion: config.id_tipo_notificacion,
                      }
                    : {}
            const whatsapp =
                config.id_tipo_notificacion === 2
                    ? {
                          state: true,
                          idTipoNotificacion: config.id_tipo_notificacion,
                      }
                    : {}

            newConfig.diasConfig.push({
                mail,
                whatsapp,
                idDiasProceso: config.id_dias_proceso,
                dias: config.dias,
            })
        } else {
            if (config.id_tipo_notificacion === 1) {
                newConfig.diasConfig[i].mail = {
                    state: true,
                    idTipoNotificacion: config.id_tipo_notificacion,
                }
            }

            if (config.id_tipo_notificacion === 2) {
                newConfig.diasConfig[i].whatsapp = {
                    state: true,
                    idTipoNotificacion: config.id_tipo_notificacion,
                }
            }
        }
    })

    newConfig.idAsesor = configs[0]?.id_asesor
    return newConfig
}
