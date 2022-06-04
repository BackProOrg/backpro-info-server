import express from 'express'
import { isAuthenticated } from '../common/utils'
import * as controller from '../controllers'

const router = express.Router()

router.get('/', (req, res) => {
    res.status(200).json({
        message: 'Server up and running',
    })
})

router.post('/login', controller.Login)

// Signin function
router.post('/signin', controller.Signin)

//  Cargar info metricas
router.post(
    '/cargarInfoMetricas',
    isAuthenticated,
    controller.cargarInfoMetricas
)

//  Cargar info principal
router.post(
    '/cargarInfoPrincipal',
    isAuthenticated,
    controller.cargarInfoPrincipal
)

//  Cargar info perfil
router.post('/cargarInfoPerfil', isAuthenticated, controller.cargarInfoPerfil)

//  Guardar info registro persona apoyo
router.post('/guardarPersona', isAuthenticated, controller.guardarPersona)

//  Actualizar info registro persona apoyo
router.post('/actualizarPersona', isAuthenticated, controller.actualizarPersona)

//  Guardar info registro plataforma
router.post('/guardarPlataforma', isAuthenticated, controller.guardarPlataforma)

//  Actualizar info registro plataforma
router.post(
    '/actualizarPlataforma',
    isAuthenticated,
    controller.actualizarPlataforma
)

//  Guardar info registro perfil
router.post(
    '/guardarInfoRegistro',
    isAuthenticated,
    controller.guardarInfoRegistro
)

//  Guardar info profesional perfil
router.post(
    '/guardarInfoProfesional',
    isAuthenticated,
    controller.guardarInfoProfesional
)

//  Cargar info cartera
router.post('/cargarInfoCartera', isAuthenticated, controller.cargarInfoCartera)

//  Cargar info pago cartera
router.post(
    '/cargarInfoPagoCartera',
    isAuthenticated,
    controller.cargarInfoPagoCartera
)

//  Cargar info renovacion
router.post(
    '/cargarInfoRenovacion',
    isAuthenticated,
    controller.cargarInfoRenovacion
)

//  Cargar info cliente polizas renovacion
router.post(
    '/cargarInfoClienteRenovacion',
    isAuthenticated,
    controller.cargarInfoClienteRenovacion
)

//  Cargar info gestiones poliza renovacion
router.post(
    '/cargarInfoGestionRenovacion',
    isAuthenticated,
    controller.cargarInfoGestionRenovacion
)

//  Cargar info poliza cliente renovacion
router.post(
    '/cargarInfoPolizaRenovacion',
    isAuthenticated,
    controller.cargarInfoPolizaRenovacion
)

//  Cargar info facturacion
router.post(
    '/cargarInfoFacturacion',
    isAuthenticated,
    controller.cargarInfoFacturacion
)

//  Cargar info cliente polizas facturacion
router.post(
    '/cargarInfoClienteFacturacion',
    isAuthenticated,
    controller.cargarInfoClienteFacturacion
)

//  Cargar info gestiones poliza facturacion
router.post(
    '/cargarInfoGestionFacturacion',
    isAuthenticated,
    controller.cargarInfoGestionFacturacion
)

//  Cargar info poliza cliente facturacion
router.post(
    '/cargarInfoPolizaFacturacion',
    isAuthenticated,
    controller.cargarInfoPolizaFacturacion
)

//  Cargar info clientes
router.post(
    '/cargarInfoClientes',
    isAuthenticated,
    controller.cargarInfoClientes
)

//  Cargar info clientes contacto
router.post(
    '/cargarInfoClienteDetalle',
    isAuthenticated,
    controller.cargarInfoClienteDetalle
)

//  Actualizar info tomador
router.post('/actualizarTomador', isAuthenticated, controller.actualizarTomador)

//  Guardar info contacto
router.post('/guardarContacto', isAuthenticated, controller.guardarContacto)

//  Actualizar info contacto
router.post(
    '/actualizarContacto',
    isAuthenticated,
    controller.actualizarContacto
)

//  Eliminar info contacto
router.post('/eliminarContacto', isAuthenticated, controller.eliminarContacto)

//  Cargar info asegurados clientes
router.post(
    '/cargarInfoAseguradosCliente',
    isAuthenticated,
    controller.cargarInfoAseguradosCliente
)

//  Actualizar info asegurados clientes
router.post(
    '/actualizarAseguradosCliente',
    isAuthenticated,
    controller.actualizarAseguradosCliente
)

//  Cargar info poliza cliente
//  router.post("/cargarInfoPolizaCliente", isAuthenticated, controller.cargarInfoPolizaCliente);

//  Cargar info configuración renovación
router.post(
    '/actualizarInfoContactoPersona',
    isAuthenticated,
    controller.actualizarInfoContactoPersona
)

//  Cargar info configuración renovación
router.post(
    '/cargarInfoEditRenovacion',
    isAuthenticated,
    controller.cargarInfoEditRenovacion
)

//  Cargar info solicitudes
router.post(
    '/cargarInfoSolicitudes',
    isAuthenticated,
    controller.cargarInfoSolicitudes
)

//  Cargar info solicitud detalle
router.post(
    '/cargarInfoSolicitudDetalle',
    isAuthenticated,
    controller.cargarInfoSolicitudDetalle
)

//  Cargar info polizas tomador
router.post('/cargarInfoPolizas', isAuthenticated, controller.cargarInfoPolizas)

//  Cargar info asegurados polizas
router.post(
    '/cargarInfoAsegurados',
    isAuthenticated,
    controller.cargarInfoAsegurados
)

//  Cargar info configuracion
router.post(
    '/cargarInfoEditCartera',
    isAuthenticated,
    controller.cargarInfoEditCartera
)

//  Cargar configuracion mensaje cartera Mail
router.post(
    '/cargarConfigMensajeMail',
    isAuthenticated,
    controller.cargarConfigMensajeMail
)

//  Cargar configuracion mensaje cartera Texto
router.post(
    '/cargarConfigMensajeTexto',
    isAuthenticated,
    controller.cargarConfigMensajeTexto
)

router.post(
    '/cargarAllConfigMensaje',
    isAuthenticated,
    controller.getAllMensajes
)

//  Guardar configuracion mensaje mail cartera
router.post(
    '/guardarConfigMensajeMail',
    isAuthenticated,
    controller.guardarConfigMensajeMail
)

//  Guardar configuracion mensaje whatsapp cartera
router.post(
    '/guardarConfigMensajeTexto',
    isAuthenticated,
    controller.guardarConfigMensajeTexto
)

//  Cargar configuracion mensaje mail renovacion
router.post(
    '/cargarConfigRenovacionMail',
    isAuthenticated,
    controller.cargarConfigRenovacionMail
)

//  Guardar configuracion mensaje mail renovacion auto
router.post(
    '/guardarConfigMailAutoRenov',
    isAuthenticated,
    controller.guardarConfigMailAutoRenov
)

//  Guardar configuracion mensaje mail renovacion salud
router.post(
    '/guardarConfigMailSaludRenov',
    isAuthenticated,
    controller.guardarConfigMailSaludRenov
)

//  Guardar configuracion mensaje mail renovacion hogar
router.post(
    '/guardarConfigMailHogarRenov',
    isAuthenticated,
    controller.guardarConfigMailHogarRenov
)

//  Guardar configuracion mensaje mail renovacion vida / otro
router.post(
    '/guardarConfigMailVidaRenov',
    isAuthenticated,
    controller.guardarConfigMailVidaRenov
)

//  Guardar configuracion mensaje mail renovacion soat
router.post(
    '/guardarConfigMailSoatRenov',
    isAuthenticated,
    controller.guardarConfigMailSoatRenov
)

//  Cargar configuracion mensaje mail solicitud
router.post(
    '/cargarConfigSolicitudMail',
    isAuthenticated,
    controller.cargarConfigSolicitudMail
)

//  Guardar configuracion mensaje mail solicitud auto
router.post(
    '/guardarConfigMailAutoSolic',
    isAuthenticated,
    controller.guardarConfigMailAutoSolic
)

//  Guardar configuracion mensaje mail solicitud salud
router.post(
    '/guardarConfigMailSaludSolic',
    isAuthenticated,
    controller.guardarConfigMailSaludSolic
)

//  Guardar configuracion mensaje mail solicitud hogar
router.post(
    '/guardarConfigMailHogarSolic',
    isAuthenticated,
    controller.guardarConfigMailHogarSolic
)

//  Guardar configuracion mensaje mail solicitud vida / otro
router.post(
    '/guardarConfigMailVidaSolic',
    isAuthenticated,
    controller.guardarConfigMailVidaSolic
)

//  Guardar configuracion mensaje mail solicitud soat
router.post(
    '/guardarConfigMailSoatSolic',
    isAuthenticated,
    controller.guardarConfigMailSoatSolic
)

//  Guardar configuracion cartera
router.post(
    '/guardarConfigCarteraGral',
    isAuthenticated,
    controller.guardarConfigCarteraGral
)

//  Actualizar configuracion cartera
router.post(
    '/actualizarConfigCarteraGral',
    isAuthenticated,
    controller.actualizarConfigCarteraGral
)

//  Eliminar configuracion cartera
router.post(
    '/eliminarConfigCarteraGral',
    isAuthenticated,
    controller.eliminarConfigCarteraGral
)

//  Guardar plantilla mail cartera
router.post(
    '/guardarPlantillaMail',
    isAuthenticated,
    controller.guardarPlantillaMail
)

//  Guardar plantilla texto cartera
router.post(
    '/guardarPlantillaTexto',
    isAuthenticated,
    controller.guardarPlantillaTexto
)

//  Guardar configuracion cartera
router.post(
    '/guardarConfigCarteraEspecial',
    isAuthenticated,
    controller.guardarConfigCarteraEspecial
)

//  Actualizar configuracion cartera
router.post(
    '/actualizarConfigCarteraEspecial',
    isAuthenticated,
    controller.actualizarConfigCarteraEspecial
)

//  Eliminar configuracion cartera
router.post(
    '/eliminarConfigCarteraEspecial',
    isAuthenticated,
    controller.eliminarConfigCarteraEspecial
)

//  Guardar configuracion renovacion
router.post(
    '/guardarConfigRenovacion',
    isAuthenticated,
    controller.guardarConfigRenovacion
)

//  Actualizar configuracion renovacion
router.post(
    '/actualizarConfigRenovacion',
    isAuthenticated,
    controller.actualizarConfigRenovacion
)

//  Guardar configuracion facturacion
router.post(
    '/guardarConfigFacturacion',
    isAuthenticated,
    controller.guardarConfigFacturacion
)

//  Actualizar configuracion facturacion
router.post(
    '/actualizarConfigFacturacion',
    isAuthenticated,
    controller.actualizarConfigFacturacion
)

//  Eliminar configuracion facturacion
router.post(
    '/eliminarConfigFacturacion',
    isAuthenticated,
    controller.eliminarConfigFacturacion
)

//  Guardar registro solicitud
router.post(
    '/guardarInfoSolicitud',
    isAuthenticated,
    controller.guardarInfoSolicitud
)

//  Eliminar registro solicitud
router.post('/eliminarSolicitud', isAuthenticated, controller.eliminarSolicitud)

//  Cargar info poliza cliente solicitud
router.post(
    '/cargarInfoPolizaSolicitud',
    isAuthenticated,
    controller.cargarInfoPolizaSolicitud
)

//  Cargar Info Soportes
router.get('/cargarSoportes', isAuthenticated, controller.cargarSoportes)

// Create whatsapp Session
router.post('/session', isAuthenticated, controller.wpSession)

export default router
