import jwt from 'jsonwebtoken'
import config from '../common/config'
import { mergeConfigCartera } from '../common/utils'
import pool from '../database/'

const { CRYPTO_SECRET } = config

export const Login = async (req, res) => {
    const { usuario, password } = req.body

    const usuario_backpro = await pool.query(
        `
      SELECT 
          A.ID_ASESOR,
          A.ID_OFICINA,
          O.ID_ASEGURADORA,
          A.ID_PAQUETE_BACKPRO,
          A.ACTIVO,
          US.USUARIO,
          US.AVATAR,
          (P.NOMBRE || ' ' || P.PRIMER_APELLIDO || ' ' || P.SEGUNDO_APELLIDO) AS NOMBRE_ASESOR, 
          P.EMAIL,
          P.CELULAR,
          P.DNI,
          P.TIPO_DNI 
      FROM
          SISTEMA.USUARIO_SISTEMA US
              INNER JOIN "general".PERSONAS P ON P.ID_PERSONA = US.ID_PERSONA 
                  INNER JOIN NEGOCIO.ASESORES A ON A.ID_PERSONA = P.ID_PERSONA 
                      INNER JOIN "general".OFICINAS O ON O.ID_OFICINA = A.ID_OFICINA 
      WHERE 
          US.USUARIO = $1
          AND US.CLAVE = MD5($2)
      `,
        [usuario, password]
    )

    if (usuario_backpro.rowCount > 0) {
        const first = 0
        let comprobar_user = usuario_backpro.rows.filter((dato) => {
            return dato
        })

        const {
            id_asesor,
            id_oficina,
            id_aseguradora,
            id_paquete_backpro,
            activo,
            usuario,
            email,
            nombre_asesor,
        } = comprobar_user[first]

        const token = jwt.sign(
            {
                comprobar_user,
            },
            CRYPTO_SECRET,
            { expiresIn: '10h' }
        )

        const response = {
            token,
            idAsesor: id_asesor,
            idOficina: id_oficina,
            idAseguradora: id_aseguradora,
            idPaquete: id_paquete_backpro,
            estado: activo === 'S' ? true : false,
            usuario,
            email,
            nombreUsuario: nombre_asesor,
        }

        res.json(response)
    } else {
        res.status(500).send({
            msg: 'Usuario y/o contraseña incorrecto',
        })
    }
}

export const Signin = async (req, res) => {
    const { nombre, email, password } = req.body

    const registrar_usuario = await pool.query(
        `
          INSERT INTO asesores 
              (nombre_asesor, usuario_backpro, password_backpro, mail_asesor, fecha_registro) 
          VALUES
              ($1, $2, MD5($3), $2, now())
      `,
        [nombre, email, password]
    )

    const usuario = await pool.query(
        `
          SELECT 
              *
          FROM asesores
          WHERE 
              usuario_backpro = $1
          AND 
              password_backpro = MD5($2)
      `,
        [email, password]
    )

    if (usuario.rowCount > 0) {
        let comprobar_user = usuario.rows.filter((dato) => {
            return dato
        })
        const token = jwt.sign(
            {
                comprobar_user,
            },
            CRYPTO_SECRET,
            { expiresIn: '10h' }
        )

        res.json({
            token,
        })
    } else {
        res.status(500).send({
            msg: 'Error al registrar usuario',
        })
    }
}

export const cargarInfoPrincipal = async (req, res) => {
    const { id_asesor } = req.body

    const clientes = await pool.query(
        `
      SELECT 
        COUNT(DISTINCT  P.ID_TOMADOR) AS CLIENTES
      FROM 
          NEGOCIO.POLIZAS P  
              INNER JOIN NEGOCIO.TOMADORES T on T.ID_TOMADOR = P.ID_TOMADOR 
              INNER JOIN NEGOCIO.TOMADORES_ASESORES TA on TA.ID_TOMADOR = P.ID_TOMADOR 
      WHERE 
          TA.ID_ASESOR = $1
          and T.ACTIVO = 'S'
      `,
        [id_asesor]
    )

    const polizas = await pool.query(
        `
      SELECT 
          COUNT(P.ID_POLIZA) AS POLIZAS
      FROM
          NEGOCIO.POLIZAS P 
              INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = P.ID_TOMADOR 
              INNER JOIN NEGOCIO.TOMADORES_ASESORES TA on TA.ID_TOMADOR = P.ID_TOMADOR  
      WHERE 
          P.ID_ASESOR = $1
          AND P.ACTIVO = 'S' 
          AND T.ACTIVO = 'S'
      `,
        [id_asesor]
    )

    const cartera = await pool.query(
        `
          SELECT 
              SUM(C.VALOR) TOTAL,
              COUNT(P.ID_TOMADOR) CANTIDAD
          FROM 
              CARTERA.CARTERAS C 
                  INNER JOIN NEGOCIO.POLIZAS P  ON P.ID_POLIZA = C.ID_POLIZA 
          WHERE 
              P.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    const renovacionResueltos = await pool.query(
        `
          SELECT 
              SUM(R.VALOR_RENOVADO) TOTAL,
              COUNT(R.ID_RENOVACION) CANTIDAD 
          FROM 
              RENOVACION.RENOVACIONES R 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = R.ID_TIPO_ESTADO 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = R.ID_POLIZA 
                      INNER JOIN NEGOCIO.ASESORES A ON A.ID_ASESOR = P.ID_ASESOR 
          WHERE 
              EXTRACT(MONTH FROM P.FECHA_FIN_VIGENCIA) = (EXTRACT(MONTH FROM CURRENT_DATE))
              AND EXTRACT(YEAR FROM P.FECHA_EXPEDICION) < EXTRACT(YEAR FROM CURRENT_DATE)
              AND P.ID_ASESOR = $1
              AND R.ID_TIPO_ESTADO <> 11
      `,
        [id_asesor]
    )

    const renovacionNoResueltos = await pool.query(
        `
          SELECT 
              SUM(R.VALOR_RENOVADO) TOTAL,
              COUNT(R.ID_RENOVACION) CANTIDAD 
          FROM 
              RENOVACION.RENOVACIONES R 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = R.ID_TIPO_ESTADO 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = R.ID_POLIZA 
                      INNER JOIN NEGOCIO.ASESORES A ON A.ID_ASESOR = P.ID_ASESOR 
          WHERE 
              EXTRACT(MONTH FROM P.FECHA_FIN_VIGENCIA) = (EXTRACT(MONTH FROM CURRENT_DATE))
              AND EXTRACT(YEAR FROM P.FECHA_EXPEDICION) < EXTRACT(YEAR FROM CURRENT_DATE)
              AND P.ID_ASESOR = $1
              AND R.ID_TIPO_ESTADO = 11
      `,
        [id_asesor]
    )

    const facturacionResueltos = await pool.query(
        `
          SELECT 
              SUM(F.VALOR_FACTURADO) TOTAL,
              COUNT(F.ID_FACTURACION) CANTIDAD 
          FROM 
              FACTURACION.FACTURACIONES F 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = F.ID_TIPO_ESTADO 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = F.ID_POLIZA 
                      INNER JOIN NEGOCIO.ASESORES A ON A.ID_ASESOR = P.ID_ASESOR 
          WHERE 
              EXTRACT(MONTH FROM P.FECHA_FIN_VIGENCIA) = (EXTRACT(MONTH FROM CURRENT_DATE))
              AND EXTRACT(YEAR FROM P.FECHA_EXPEDICION) < EXTRACT(YEAR FROM CURRENT_DATE)
              AND P.ID_ASESOR = $1
              AND F.ID_TIPO_ESTADO = 11
      `,
        [id_asesor]
    )

    const facturacionNoResueltos = await pool.query(
        `
          SELECT 
              SUM(F.VALOR_FACTURADO) TOTAL,
              COUNT(F.ID_FACTURACION) CANTIDAD 
          FROM 
              FACTURACION.FACTURACIONES F 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = F.ID_TIPO_ESTADO 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = F.ID_POLIZA 
                      INNER JOIN NEGOCIO.ASESORES A ON A.ID_ASESOR = P.ID_ASESOR 
          WHERE 
              EXTRACT(MONTH FROM P.FECHA_FIN_VIGENCIA) = (EXTRACT(MONTH FROM CURRENT_DATE))
              AND EXTRACT(YEAR FROM P.FECHA_EXPEDICION) < EXTRACT(YEAR FROM CURRENT_DATE)
              AND P.ID_ASESOR = $1
              AND F.ID_TIPO_ESTADO <> 11
      `,
        [id_asesor]
    )

    // const cantidad_solicitudes = await pool.query(`
    //     SELECT
    //         COUNT(DISTINCT s.id_solicitud) AS total
    //     FROM solicitudes AS s
    //     INNER JOIN solicitudes_gestiones AS sg ON s.id_solicitud = sg.id_solicitud
    //     INNER JOIN gestiones AS g ON sg.id_gestion = g.id_gestion
    //     WHERE s.id_asesor = $1 AND s.id_estado_solicitud <> 11
    // `,[id_asesor]);

    // const solicitudes = await pool.query(`
    //     SELECT
    //         COUNT(DISTINCT s.id_solicitud) AS total
    //     FROM solicitudes AS s
    //     INNER JOIN solicitudes_gestiones AS sg ON s.id_solicitud = sg.id_solicitud
    //     INNER JOIN gestiones AS g ON sg.id_gestion = g.id_gestion
    //     WHERE s.id_asesor = $1
    // `,[id_asesor]);

    // const por_solicitudes = await pool.query(`
    //     SELECT
    //         COUNT(DISTINCT s.id_solicitud) AS total
    //     FROM solicitudes AS s
    //     INNER JOIN solicitudes_gestiones AS sg ON s.id_solicitud = sg.id_solicitud
    //     INNER JOIN gestiones AS g ON sg.id_gestion = g.id_gestion
    //     WHERE s.id_asesor = $1 AND s.id_estado_solicitud = 11
    // `,[id_asesor]);

    res.json({
        clientes: parseInt(clientes.rows[0].clientes),
        polizas: parseInt(polizas.rows[0].polizas),
        cartera: cartera.rows[0],
        renovacionResueltos: renovacionResueltos.rows[0],
        renovacionNoResueltos: renovacionNoResueltos.rows[0],
        facturacionResueltos: facturacionResueltos.rows[0],
        facturacionNoResueltos: facturacionNoResueltos.rows[0],
    })
}

export const cargarInfoMetricas = async (req, res) => {
    const { id_asesor } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const polizas = await pool.query(
        `
          SELECT 
              COUNT(activo_poliza) AS cantidad
          FROM polizas 
          WHERE id_asesor = $1 AND activo_poliza = true
      `,
        [id_asesor]
    )

    const clientes = await pool.query(
        `
          SELECT 
              COUNT(t.id_tomador) AS cantidad 
          FROM tomadores_asesores AS ta 
          INNER JOIN tomadores AS t ON t.id_tomador = ta.id_tomador 
          WHERE ta.id_asesor = $1 AND t.activo = true
      `,
        [id_asesor]
    )

    const primas = await pool.query(
        `
          SELECT 
              SUM(valor_prima_actual) AS total
          FROM polizas 
          WHERE id_asesor = $1 AND activo_poliza = true
      `,
        [id_asesor]
    )

    const renovados = await pool.query(
        `
          SELECT 
              SUM(r.valor_renovado) AS total
          FROM polizas AS p 
          INNER JOIN renovaciones AS r ON r.id_poliza = p.id_poliza
          WHERE p.id_asesor = $1 AND p.activo_poliza = true
      `,
        [id_asesor]
    )

    const year = await pool.query(`SELECT EXTRACT(YEAR FROM NOW()) - 1 AS year`)
    const fecha = year.rows[0].year + '-12' + '-31'

    const cartera = await pool.query(
        `
          SELECT 
              SUM(valor_cartera) AS total,
              COUNT(id_tomador) AS cantidad
          FROM cartera 
          WHERE id_asesor = $1
      `,
        [id_asesor]
    )

    const cabecera = await pool.query(
        `
          SELECT 
              TO_CHAR(MAX(fecha_actualizacion), 'DD TMMon YYYY') AS fecha
          FROM cartera 
          WHERE id_asesor = $1
      `,
        [id_asesor]
    )

    res.json([
        polizas.rows,
        clientes.rows,
        primas.rows,
        renovados.rows,
        cartera.rows,
        cabecera.rows,
    ])
}

export const cargarInfoPerfil = async (req, res) => {
    const { id_asesor } = req.body

    const infoProfesional = await pool.query(
        `
              SELECT 
                  AG.NOMBRE AS ASEGURADORA,
                  O.NOMBRE AS OFICINA,
                  PB.NOMBRE AS PAQUETE_BACKPRO,
                  TD.DESCRIPCION AS TIPO_DNI,
                  P.DNI,
                  P.CELULAR,
                  P.EMAIL 
              FROM NEGOCIO.ASESORES A 
                      INNER JOIN GENERAL.OFICINAS O ON A.ID_OFICINA = O.ID_OFICINA 
                          INNER JOIN GENERAL.ASEGURADORAS AG ON O.ID_ASEGURADORA = AG.ID_ASEGURADORA
                      INNER JOIN GENERAL.PAQUETES_BACKPRO PB ON A.ID_PAQUETE_BACKPRO = PB.ID_PAQUETE_BACKPRO
                      INNER JOIN GENERAL.PERSONAS P ON A.ID_PERSONA = P.ID_PERSONA
                          INNER JOIN SISTEMA.TIPO_DNI TD ON P.TIPO_DNI = TD.ID_TIPO_DNI
              WHERE A.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    const personasApoyo = await pool.query(
        `
          SELECT
              A.ID_APOYO,
              A.ID_PERSONA,
              P.NOMBRE,
              P.PRIMER_APELLIDO,
              P.EMAIL,
              P.CELULAR, 
              AA.ID_ASESOR,
              A.ID_TIPO_ROL, 
              TR.DESCRIPCION 
          FROM 
              NEGOCIO.APOYOS A 
                  INNER JOIN "general".PERSONAS P ON P.ID_PERSONA = A.ID_PERSONA 
                  INNER JOIN SISTEMA.TIPO_ROL TR ON TR.ID_TIPO_ROL = A.ID_TIPO_ROL 
                  INNER JOIN NEGOCIO.ASESORES_APOYOS AA ON AA.ID_APOYO = A.ID_APOYO 
          WHERE 
              AA.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    const tipoRol = await pool.query(`
          SELECT
              TR.ID_TIPO_ROL,
              TR.DESCRIPCION,
              TR.FECHA_ACTUALIZACION 
          FROM 
              SISTEMA.TIPO_ROL TR 
      `)

    const accesoPlataformas = await pool.query(
        `
          SELECT
              AAP.ID_ASESOR,
              AP.ID_ACCESO_PLATAFORMA, 
              AP.ID_PLATAFORMA,
              P.NOMBRE,
              P.LINK,
              AP.USUARIO,
              AP.CLAVE,
              AP.FECHA_ACTUALIZACION 
          FROM 
              SISTEMA.ACCESOS_PLATAFORMAS AP
                  INNER JOIN SISTEMA.PLATAFORMAS P ON P.ID_PLATAFORMA = AP.ID_PLATAFORMA 
                  INNER JOIN NEGOCIO.ASESORES_PLATAFORMAS AAP ON AAP.ID_ACCESO_PLATAFORMA = AP.ID_ACCESO_PLATAFORMA 
          WHERE 
              AAP.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    const plataformas_info = await pool.query(`
          SELECT 
              P.ID_PLATAFORMA,
              P.NOMBRE,
              P.LINK,
              P.FECHA_ACTUALIZACION
          FROM 
              SISTEMA.PLATAFORMAS P
      `)

    res.json([
        infoProfesional.rows,
        personasApoyo,
        tipoRol,
        accesoPlataformas,
        plataformas_info,
    ])
}

export const guardarInfoRegistro = async (req, res) => {
    const {
        id_asesor,
        nombre_asesor,
        usuario_backpro,
        password_backpro,
        firma,
    } = req.body

    const registro = await pool.query(
        `
          UPDATE 
              asesores
          SET
              nombre_asesor = $2,
              mail_asesor = $3,
              usuario_backpro = $3,
              password_backpro = MD5($4),
              firma_asesor = $5,
              fecha_actualizacion = now()
          WHERE
              id_asesor = $1
      `,
        [id_asesor, nombre_asesor, usuario_backpro, password_backpro, firma]
    )

    const usuario = await pool.query(
        `
          SELECT 
              *
          FROM asesores
          WHERE 
              usuario_backpro = $1
          AND 
              password_backpro = MD5($2)
      `,
        [usuario_backpro, password_backpro]
    )

    let comprobar_user = usuario.rows.filter((dato) => {
        return dato
    })
    const token = jwt.sign(
        {
            comprobar_user,
        },
        CRYPTO_SECRET,
        { expiresIn: '10h' }
    )

    res.json({
        token,
        msg: 'Registro informaciOn exitosa!!',
    })
}

export const guardarInfoProfesional = async (req, res) => {
    const {
        id_asesor,
        id_aseguradora,
        id_oficina,
        id_paq_backpro,
        id_tipo_dni,
        dni_asesor,
        cel_asesor,
        mail_asesor,
        password_mail_asesor,
    } = req.body

    const registro = await pool.query(
        `
          UPDATE 
              asesores
          SET
              id_aseguradora = $2,
              id_oficina = $3,
              id_paq_backpro = $4,
              id_tipo_dni = $5,
              dni_asesor = $6,
              cel_asesor = $7,
              mail_asesor = $8,
              password_mail_asesor = $9,
              fecha_actualizacion = now()
          WHERE
              id_asesor = $1
      `,
        [
            id_asesor,
            id_aseguradora,
            id_oficina,
            id_paq_backpro,
            id_tipo_dni,
            dni_asesor,
            cel_asesor,
            mail_asesor,
            password_mail_asesor,
        ]
    )

    const usuario = await pool.query(
        `
          SELECT 
              *
          FROM asesores
          WHERE 
              id_asesor = $1
      `,
        [id_asesor]
    )

    let comprobar_user = usuario.rows.filter((dato) => {
        return dato
    })
    const token = jwt.sign(
        {
            comprobar_user,
        },
        CRYPTO_SECRET,
        { expiresIn: '10h' }
    )

    res.json({
        token,
        msg: 'Registro informaciOn profesional exitosa!!',
    })
}

export const guardarPersona = async (req, res) => {
    const {
        id_asesor,
        id_tipo_rol,
        nombre_persona,
        mail_persona,
        cel_persona,
    } = req.body

    const get_registro = await pool.query(`
          SELECT nextval('personas_apoyo_id_persona_apoyo_seq') as id_persona_apoyo
      `)

    const id_persona_apoyo = get_registro.rows[0].id_persona_apoyo

    const registro = await pool.query(
        `
          INSERT INTO 
              personas_apoyo
          VALUES ( 
              $1, $3, $4, $5, now(), now(), $2
          )
      `,
        [
            id_persona_apoyo,
            id_tipo_rol,
            nombre_persona,
            mail_persona,
            cel_persona,
        ]
    )

    const relacion = await pool.query(
        `
          INSERT INTO 
              asesores_personas_apoyo
          VALUES ( 
              $1, $2
          )
      `,
        [id_asesor, id_persona_apoyo]
    )

    res.json({
        msg: 'Registro persona apoyo exitosa!!',
    })
}

export const actualizarPersona = async (req, res) => {
    const {
        id_persona_apoyo,
        id_tipo_rol,
        nombre_persona,
        mail_persona,
        cel_persona,
    } = req.body

    const registro = await pool.query(
        `
          UPDATE 
              personas_apoyo
          SET 
              id_tipo_rol = $2, 
              nombre_persona = $3, 
              mail_persona = $4, 
              cel_persona = $5, 
              fecha_actualizacion = now()
          WHERE id_persona_apoyo = $1
      `,
        [
            id_persona_apoyo,
            id_tipo_rol,
            nombre_persona,
            mail_persona,
            cel_persona,
        ]
    )

    res.json({
        msg: 'ActualizaciOn persona apoyo exitosa!!',
    })
}

export const guardarPlataforma = async (req, res) => {
    const {
        id_asesor,
        plataforma_foranea,
        usuario_plataforma,
        password_plataforma,
    } = req.body

    const get_registro = await pool.query(`
          SELECT nextval('plataformas_id_plataforma_seq') as id_plataforma
      `)

    const id_plataforma = get_registro.rows[0].id_plataforma

    const registro = await pool.query(
        `
          INSERT INTO 
              plataformas
          VALUES ( 
              $1, $3, $4, now(), now(), $2
          )
      `,
        [
            id_plataforma,
            plataforma_foranea,
            usuario_plataforma,
            password_plataforma,
        ]
    )

    const relacion = await pool.query(
        `
          INSERT INTO 
              asesores_plataformas 
          VALUES ( 
              $1, $2
          )
      `,
        [id_asesor, id_plataforma]
    )

    res.json({
        msg: 'Registro plataforma exitosa!!',
    })
}

export const actualizarPlataforma = async (req, res) => {
    const {
        id_plataforma,
        plataforma_foranea,
        usuario_plataforma,
        password_plataforma,
    } = req.body

    const registro = await pool.query(
        `
          UPDATE 
              plataformas
          SET 
              plataforma_foranea = $2, 
              usuario_plataforma = $3, 
              password_plataforma = $4, 
              fecha_actualizacion = now()
          WHERE id_plataforma = $1
      `,
        [
            id_plataforma,
            plataforma_foranea,
            usuario_plataforma,
            password_plataforma,
        ]
    )

    res.json({
        msg: 'ActualizaciOn plataforma exitosa!!',
    })
}

export const cargarInfoCartera = async (req, res) => {
    const { id_asesor } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const periodica = await pool.query(
        `
          SELECT
              PS.TIPO_DNI,
              T.ID_TOMADOR,
              PS.NOMBRE,
              C.IS_CARTERA_ESPECIAL,
              ARRAY(SELECT 
                  PO.NOMBRE_POLIZA AS POLIZA
               FROM
                  CARTERA.CARTERAS C 
                      INNER JOIN NEGOCIO.POLIZAS PO ON C.ID_POLIZA = PO.ID_POLIZA
                      INNER JOIN SISTEMA.TIPO_CARTERA TC ON C.ID_TIPO_CARTERA = TC.ID_TIPO_CARTERA
               WHERE
                  PO.ID_ASESOR = $1
                  AND TC.ID_TIPO_CARTERA = 1
              ) AS POLIZA,
              COUNT(P.ID_POLIZA) AS SUM_POLIZAS, 
              SUM(C.DIAS) AS DIAS,
              SUM(C.VALOR) AS PRECIO
          FROM
              CARTERA.CARTERAS C 
                  INNER JOIN NEGOCIO.POLIZAS P ON C.ID_POLIZA = P.ID_POLIZA
                      INNER JOIN NEGOCIO.TOMADORES T ON P.ID_TOMADOR = T.ID_TOMADOR
                          INNER JOIN GENERAL.PERSONAS PS ON T.ID_PERSONA = PS.ID_PERSONA
                      INNER JOIN NEGOCIO.ASESORES A ON P.ID_ASESOR = A.ID_ASESOR
                  INNER JOIN SISTEMA.TIPO_CARTERA TC ON C.ID_TIPO_CARTERA = TC.ID_TIPO_CARTERA
          WHERE
              A.ID_ASESOR = $1
              AND TC.ID_TIPO_CARTERA = 1
          GROUP BY 
              PS.TIPO_DNI,
              T.ID_TOMADOR,
              PS.NOMBRE,
              P.NOMBRE_POLIZA,
              C.IS_CARTERA_ESPECIAL,
              C.DIAS,
              C.VALOR
          ORDER BY
              C.DIAS DESC
      `,
        [id_asesor]
    )

    const financiada = await pool.query(
        `
          SELECT
              PS.TIPO_DNI,
              T.ID_TOMADOR,
              PS.NOMBRE,
              C.IS_CARTERA_ESPECIAL,
              ARRAY(SELECT 
                  PO.NOMBRE_POLIZA AS POLIZA
               FROM
                  CARTERA.CARTERAS C 
                      INNER JOIN NEGOCIO.POLIZAS PO ON C.ID_POLIZA = PO.ID_POLIZA
                      INNER JOIN SISTEMA.TIPO_CARTERA TC ON C.ID_TIPO_CARTERA = TC.ID_TIPO_CARTERA
               WHERE
                  PO.ID_ASESOR = $1
                  AND TC.ID_TIPO_CARTERA = 2
              ) AS POLIZA,
              COUNT(P.ID_POLIZA) AS SUM_POLIZAS, 
              SUM(C.DIAS) AS DIAS,
              SUM(C.VALOR) AS PRECIO
          FROM
              CARTERA.CARTERAS C 
                  INNER JOIN NEGOCIO.POLIZAS P ON C.ID_POLIZA = P.ID_POLIZA
                      INNER JOIN NEGOCIO.TOMADORES T ON P.ID_TOMADOR = T.ID_TOMADOR
                          INNER JOIN GENERAL.PERSONAS PS ON T.ID_PERSONA = PS.ID_PERSONA
                      INNER JOIN NEGOCIO.ASESORES A ON P.ID_ASESOR = A.ID_ASESOR
                  INNER JOIN SISTEMA.TIPO_CARTERA TC ON C.ID_TIPO_CARTERA = TC.ID_TIPO_CARTERA
          WHERE
              A.ID_ASESOR = $1
              AND TC.ID_TIPO_CARTERA = 2
          GROUP BY 
              PS.TIPO_DNI,
              T.ID_TOMADOR,
              PS.NOMBRE,
              C.IS_CARTERA_ESPECIAL,
              P.NOMBRE_POLIZA,
              C.DIAS,
              C.VALOR
          ORDER BY
              C.DIAS DESC
      `,
        [id_asesor]
    )

    const favor = await pool.query(
        `
          SELECT
              PS.TIPO_DNI,
              T.ID_TOMADOR,
              PS.NOMBRE,
              C.IS_CARTERA_ESPECIAL,
              ARRAY(SELECT 
                  PO.NOMBRE_POLIZA AS POLIZA
              FROM
                  CARTERA.CARTERAS C 
                      INNER JOIN NEGOCIO.POLIZAS PO ON C.ID_POLIZA = PO.ID_POLIZA
                      INNER JOIN SISTEMA.TIPO_CARTERA TC ON C.ID_TIPO_CARTERA = TC.ID_TIPO_CARTERA
              WHERE
                  PO.ID_ASESOR = $1
                  AND TC.ID_TIPO_CARTERA = 3
              ) AS POLIZA,
              COUNT(P.ID_POLIZA) AS SUM_POLIZAS, 
              SUM(C.DIAS) AS DIAS,
              SUM(C.VALOR) AS PRECIO
          FROM
              CARTERA.CARTERAS C 
                  INNER JOIN NEGOCIO.POLIZAS P ON C.ID_POLIZA = P.ID_POLIZA
                      INNER JOIN NEGOCIO.TOMADORES T ON P.ID_TOMADOR = T.ID_TOMADOR
                          INNER JOIN GENERAL.PERSONAS PS ON T.ID_PERSONA = PS.ID_PERSONA
                      INNER JOIN NEGOCIO.ASESORES A ON P.ID_ASESOR = A.ID_ASESOR
                  INNER JOIN SISTEMA.TIPO_CARTERA TC ON C.ID_TIPO_CARTERA = TC.ID_TIPO_CARTERA
          WHERE
              A.ID_ASESOR = $1
              AND TC.ID_TIPO_CARTERA = 3
          GROUP BY 
              PS.TIPO_DNI,
              T.ID_TOMADOR,
              PS.NOMBRE,
              C.IS_CARTERA_ESPECIAL,
              P.NOMBRE_POLIZA,
              C.DIAS,
              C.VALOR
          ORDER BY
              C.DIAS DESC
      `,
        [id_asesor]
    )

    const cabecera = await pool.query(
        `
          SELECT 
              SUM(c.valor) AS cartera,
              COUNT(t.id_tomador) AS clientes,
              TO_CHAR(MAX(c.fecha_actualizacion), 'DD TMMon YYYY') AS fecha
          FROM cartera.carteras c
                  inner join negocio.polizas p on c.id_poliza = p.id_poliza
                      inner join negocio.tomadores t on p.id_tomador = t.id_tomador
          WHERE id_asesor = $1
      `,
        [id_asesor]
    )

    res.json([periodica.rows, financiada.rows, favor.rows, cabecera.rows])
}

export const cargarInfoPagoCartera = async (req, res) => {
    const { id_asesor, id_tomador } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const pagos = await pool.query(
        `
          SELECT 
              P.ID_TOMADOR,
              P.ID_ASESOR,
              C.DIAS,
              TC.DESCRIPCION,
              P.NUMERO,
              P.NOMBRE_POLIZA,
              C.VALOR 
          FROM 
              CARTERA.CARTERAS C 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = C.ID_POLIZA 
                  INNER JOIN SISTEMA.TIPO_CARTERA TC ON TC.ID_TIPO_CARTERA = C.ID_TIPO_CARTERA 
          WHERE 
              P.ID_ASESOR = $1
              AND P.ID_TOMADOR = $2
          `,
        [id_asesor, id_tomador]
    )

    const mails = await pool.query(
        `
          SELECT 
              N.ID_NOTIFICACION AS ID_GESTION,
              N.ASUNTO_NOTIFICACION AS ASUNTO,
              N.CONTENIDO_NOTIFICACION AS CONTENIDO,
              N.FECHA_NOTIFICACION AS FECHA
          FROM GENERAL.NOTIFICACIONES N
                  INNER JOIN NEGOCIO.NOTIFICACIONES_POLIZAS NP ON N.ID_NOTIFICACION = NP.ID_NOTIFICACION
                      INNER JOIN NEGOCIO.POLIZAS P ON NP.ID_POLIZA = P.ID_POLIZA
                          INNER JOIN CARTERA.CARTERAS C ON P.ID_POLIZA = C.ID_POLIZA
          WHERE
              P.ID_ASESOR = $1
              AND P.ID_TOMADOR = $2
              AND N.ID_TIPO_NOTIFICACION = 1
              AND N.FECHA_NOTIFICACION >= DATE(NOW()) - INTERVAL '20 DAY'
      `,
        [id_asesor, id_tomador]
    )

    const whatsapp = await pool.query(
        `
          SELECT 
              N.ID_NOTIFICACION AS ID_GESTION,
              N.ASUNTO_NOTIFICACION AS ASUNTO,
              N.CONTENIDO_NOTIFICACION AS CONTENIDO,
              N.FECHA_NOTIFICACION AS FECHA
          FROM GENERAL.NOTIFICACIONES N
                  INNER JOIN NEGOCIO.NOTIFICACIONES_POLIZAS NP ON N.ID_NOTIFICACION = NP.ID_NOTIFICACION
                      INNER JOIN NEGOCIO.POLIZAS P ON NP.ID_POLIZA = P.ID_POLIZA
                          INNER JOIN CARTERA.CARTERAS C ON P.ID_POLIZA = C.ID_POLIZA
          WHERE
              P.ID_ASESOR = $1
              AND P.ID_TOMADOR = $2
              AND N.ID_TIPO_NOTIFICACION = 2
              AND N.FECHA_NOTIFICACION >= DATE(NOW()) - INTERVAL '20 DAY'
      `,
        [id_asesor, id_tomador]
    )

    const sms = await pool.query(
        `
          SELECT 
              N.ID_NOTIFICACION AS ID_GESTION,
              N.ASUNTO_NOTIFICACION AS ASUNTO,
              N.CONTENIDO_NOTIFICACION AS CONTENIDO,
              N.FECHA_NOTIFICACION AS FECHA
          FROM GENERAL.NOTIFICACIONES N
                  INNER JOIN NEGOCIO.NOTIFICACIONES_POLIZAS NP ON N.ID_NOTIFICACION = NP.ID_NOTIFICACION
                      INNER JOIN NEGOCIO.POLIZAS P ON NP.ID_POLIZA = P.ID_POLIZA
                          INNER JOIN CARTERA.CARTERAS C ON P.ID_POLIZA = C.ID_POLIZA
          WHERE
              P.ID_ASESOR = $1
              AND P.ID_TOMADOR = $2
              AND N.ID_TIPO_NOTIFICACION = 3
              AND N.FECHA_NOTIFICACION >= DATE(NOW()) - INTERVAL '20 DAY'
      `,
        [id_asesor, id_tomador]
    )

    const cabecera = await pool.query(
        `
          SELECT 
              PS.NOMBRE,
              (TD.ALIAS || ' ' || PS.DNI) AS DOCUMENTO,
              TD.ID_TIPO_DNI,
              SUM(C.VALOR) AS CARTERA,
              TO_CHAR(MAX(C.FECHA_ACTUALIZACION), 'DD TMMon YYYY') AS FECHA
          FROM CARTERA.CARTERAS C 
                  INNER JOIN NEGOCIO.POLIZAS P ON C.ID_POLIZA = P.ID_POLIZA
                      INNER JOIN NEGOCIO.TOMADORES T ON P.ID_TOMADOR = T.ID_TOMADOR
                          INNER JOIN GENERAL.PERSONAS PS ON T.ID_PERSONA = PS.ID_PERSONA
                              INNER JOIN SISTEMA.TIPO_DNI TD ON PS.TIPO_DNI = TD.ID_TIPO_DNI 
          WHERE P.ID_ASESOR = $1 AND P.ID_TOMADOR = $2
          GROUP BY 
              PS.NOMBRE,
              TD.ALIAS,
              PS.DNI,
              TD.ID_TIPO_DNI,
              C.VALOR,
              C.FECHA_ACTUALIZACION
      `,
        [id_asesor, id_tomador]
    )

    res.json({
        pagos: pagos.rows,
        mails: mails.rows,
        whatsapp: whatsapp.rows,
        sms: sms.rows,
        cabecera: cabecera.rows,
    })
}

export const cargarInfoFacturacion = async (req, res) => {
    const { id_asesor, mes } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const mesComun = await pool.query(
        `
          SELECT 
              P.ID_POLIZA,
              P.NOMBRE_POLIZA, 
              P.NUMERO, 
              P.ID_TOMADOR,
              PE.NOMBRE AS NOMBRE_TOMADOR,
              PE.DNI AS DNI_TOMADOR,
              P.ID_ASESOR,
              PE2.NOMBRE AS NOMBRE_ASESOR,
              P.FECHA_EXPEDICION,
              P.FECHA_FIN_VIGENCIA,
              TR.ID_TIPO_RAMO,
              F.ID_TIPO_ESTADO,
              TE.DESCRIPCION AS DESCRIPCION_ESTADO,
              P.VALOR_PRIMA_ANTERIOR,
              P.VALOR_PRIMA_ACTUAL,
              P.VALOR_CUOTA_ANTERIOR,
              P.VALOR_CUOTA_ACTUAL,
              TO_CHAR(TO_DATE((EXTRACT(MONTH FROM CURRENT_DATE))::text, 'MM'), 'TMMonth') AS "NombreMes" 
          FROM 
              FACTURACION.FACTURACIONES F 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = F.ID_TIPO_ESTADO 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = F.ID_POLIZA 
                      INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = P.ID_TOMADOR 
                          INNER JOIN "general".PERSONAS PE ON PE.ID_PERSONA = T.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI ON TDNI.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN NEGOCIO.ASESORES A ON A.ID_ASESOR = P.ID_ASESOR 
                          INNER JOIN "general".PERSONAS PE2 ON PE2.ID_PERSONA = A.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI2 ON TDNI2.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN SISTEMA.TIPO_RAMO TR ON TR.ID_TIPO_RAMO = P.ID_TIPO_RAMO
          WHERE 
              EXTRACT(MONTH FROM P.FECHA_FIN_VIGENCIA) = $1
              AND EXTRACT(YEAR FROM P.FECHA_EXPEDICION) < EXTRACT(YEAR FROM CURRENT_DATE)
              AND TR.ID_TIPO_RAMO <> 32
              AND P.ID_ASESOR = $2
      `,
        [mes, id_asesor]
    )

    const cabecera = await pool.query(
        `
          SELECT 
              COUNT(P.ID_TOMADOR) AS CLIENTES
          FROM 
              FACTURACION.FACTURACIONES F 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = F.ID_POLIZA 
          WHERE 
              P.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    res.json([mesComun.rows, cabecera.rows])
}

export const cargarInfoClienteFacturacion = async (req, res) => {
    const { id_asesor, id_tomador, id_poliza } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const registros = await pool.query(
        `
          SELECT 
              P.ID_POLIZA,
              P.ID_TOMADOR,
              P.ID_ASESOR,
              P.NUMERO,
              P.NOMBRE_POLIZA,
              P.ACTIVO,
              P.VALOR_PRIMA_ANTERIOR, 
              P.VALOR_PRIMA_ACTUAL, 
              P.VALOR_CUOTA_ANTERIOR,
              P.VALOR_CUOTA_ACTUAL,
              P.FECHA_FIN_VIGENCIA 
          FROM 
              FACTURACION.FACTURACIONES F 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = F.ID_POLIZA 
          WHERE 
              P.ID_POLIZA = $1
      `,
        [id_poliza]
    )

    const cabecera = await pool.query(
        `
          SELECT 
              PE.NOMBRE,
              (TDNI.ALIAS || ' ' || PE.DNI) DOCUMENTO,
              TDNI.ID_TIPO_DNI,
              SUM(P.VALOR_PRIMA_ACTUAL) POLIZA,
          FROM 
              FACTURACION.FACTURACIONES F 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = F.ID_POLIZA 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = F.ID_TIPO_ESTADO 
                      INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = P.ID_TOMADOR 
                          INNER JOIN "general".PERSONAS PE ON PE.ID_PERSONA = T.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI ON TDNI.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN NEGOCIO.ASESORES A ON A.ID_ASESOR = P.ID_ASESOR 
                          INNER JOIN "general".PERSONAS PE2 ON PE2.ID_PERSONA = A.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI2 ON TDNI2.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN SISTEMA.TIPO_RAMO TR ON TR.ID_TIPO_RAMO = P.ID_TIPO_RAMO
          WHERE 
              P.ID_TOMADOR = $1
              AND P.ID_ASESOR = $2
          GROUP BY 
              PE.NOMBRE,
              TDNI.ALIAS,
              PE.DNI,
              TDNI.ID_TIPO_DNI
      `,
        [id_asesor, id_tomador]
    )

    res.json([registros.rows, cabecera.rows])
}

export const cargarInfoGestionFacturacion = async (req, res) => {
    const { id_asesor, id_tomador, id_poliza } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const mails = await pool.query(
        `
          SELECT
              N.ID_NOTIFICACION,
              N.ASUNTO_NOTIFICACION, 
              N.CONTENIDO_NOTIFICACION,
              N.ID_TIPO_PROCESO_NOTIFICACION,
              N.FECHA_NOTIFICACION 
          FROM 
              "general".NOTIFICACIONES N 
                  INNER JOIN SISTEMA.TIPO_PROCESO_NOTIFICACION TPN ON TPN.ID_TIPO_PROCESO_NOTIFICACION = N.ID_TIPO_PROCESO_NOTIFICACION 
                  INNER JOIN SISTEMA.TIPO_NOTIFICACION TN ON TN.ID_TIPO_NOTIFICACION = N.ID_TIPO_NOTIFICACION 
                  INNER JOIN NEGOCIO.NOTIFICACIONES_POLIZAS NP ON NP.ID_NOTIFICACION = N.ID_NOTIFICACION 
                      INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = NP.ID_POLIZA 
          WHERE 
              P.ID_POLIZA = $1
              AND P.ID_ASESOR = $2
              AND P.ID_TOMADOR = $3
              AND N.ID_TIPO_NOTIFICACION = 1
              AND N.ID_TIPO_PROCESO_NOTIFICACION = 3
              `,
        [id_poliza, id_asesor, id_tomador]
    )

    const cabecera = await pool.query(
        `
              SELECT 
                  PE.NOMBRE,
                  (TDNI.ALIAS || ' ' || PE.DNI) DOCUMENTO,
                  TDNI.ID_TIPO_DNI,
                  SUM(F.VALOR_FACTURADO) TOTAL,
              FROM 
                  FACTURACION.FACTURACIONES F 
                      INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = F.ID_POLIZA 
                      INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = F.ID_TIPO_ESTADO 
                          INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = P.ID_TOMADOR 
                              INNER JOIN "general".PERSONAS PE ON PE.ID_PERSONA = T.ID_PERSONA 
                                  INNER JOIN SISTEMA.TIPO_DNI TDNI ON TDNI.ID_TIPO_DNI = PE.TIPO_DNI 
                          INNER JOIN SISTEMA.TIPO_RAMO TR ON TR.ID_TIPO_RAMO = P.ID_TIPO_RAMO
              WHERE 
                  P.ID_POLIZA = $1
                  AND P.ID_TOMADOR = $2
                  AND P.ID_ASESOR = $3
              GROUP BY 
                  PE.NOMBRE,
                  TDNI.ALIAS,
                  PE.DNI,
                  TDNI.ID_TIPO_DNI
      `,
        [id_poliza, id_asesor, id_tomador]
    )

    res.json([mails.rows, whatsapp.rows, sms.rows, cabecera.rows])
}

export const cargarInfoPolizaFacturacion = async (req, res) => {
    const { id_asesor, id_tomador, id_poliza } = req.body

    //ool.query(`set lc_time='es_ES.UTF-8';`);

    const registros = await pool.query(
        `
          SELECT 
              P.NUMERO,
              P.NOMBRE_POLIZA,
              P.ACTIVO,
              P.FECHA_INICIO_VIGENCIA 
          FROM 
              NEGOCIO.POLIZAS P 
          WHERE 
              P.ID_POLIZA = $1
      `,
        [id_poliza]
    )

    const cabecera = await pool.query(
        `
          SELECT 
              PE.NOMBRE,
              (TDNI.ALIAS || ' ' || PE.DNI) DOCUMENTO,
              TDNI.ID_TIPO_DNI,
              SUM(F.VALOR_FACTURADO) TOTAL,
          FROM 
              FACTURACION.FACTURACIONES F 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = F.ID_POLIZA 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = F.ID_TIPO_ESTADO 
                      INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = P.ID_TOMADOR 
                          INNER JOIN "general".PERSONAS PE ON PE.ID_PERSONA = T.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI ON TDNI.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN SISTEMA.TIPO_RAMO TR ON TR.ID_TIPO_RAMO = P.ID_TIPO_RAMO
          WHERE 
              P.ID_POLIZA = $1
              AND P.ID_TOMADOR = $2
              AND P.ID_ASESOR = $3
          GROUP BY 
              PE.NOMBRE,
              TDNI.ALIAS,
              PE.DNI,
              TDNI.ID_TIPO_DNI
      `,
        [id_poliza, id_asesor, id_tomador]
    )

    const detalle = await pool.query(
        `
          SELECT 
              P.CARATULA_ANTERIOR,
              P.CARATULA_ACTUAL 
          FROM 
              NEGOCIO.POLIZAS P 
          WHERE 
              P.ID_POLIZA = $1
      `,
        [id_poliza]
    )

    res.json([registros.rows, cabecera.rows, detalle.rows])
}

export const cargarInfoEditRenovacion = async (req, res) => {
    const { id_asesor } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const dias = await pool.query(
        `
          SELECT
              CGR.ID_ASESOR,
              CGR.ID_ENVIO_RENOVACION_GENERAL,
              DPP.DIAS DIAS_PROCESO_RENOVACION,
              DPP2.DIAS DIAS_PROCESO_SOAT
          FROM
              SISTEMA.CONFIGURACION_GENERAL_RENOVACION CGR 
                  INNER JOIN "general".DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = CGR.ID_DIAS_PROCESO_RENOVACION 
                  INNER JOIN "general".DIAS_POR_PROCESO DPP2 ON DPP2.ID_DIAS_PROCESO = CGR.ID_DIAS_PROCESO_SOAT 
          WHERE
              CGR.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    const mensajes = await pool.query(
        `
          SELECT 
              CGR.ID_ASESOR,
              ERG.ID_TIPO_RAMO,
              TR.DESCRIPCION,
              R.ID_RAMO,
              R.NOMBRE,
              PMR.ASUNTO_INTRO,
              PMR.ASUNTO_POLIZA,
              PMR.ASUNTO_REFERENCIA,
              PMR.ASUNTO_CONECTOR,
              PMR.ASUNTO_CLIENTE,
              PMR.CONTENIDO_INICIAL,
              PMR.CONTENIDO_CLIENTE,
              PMR.CONTENIDO_SALUDO,
              PMR.CONTENIDO_AGRADECIMIENTO,
              PMR.CONTENIDO_ENTORNO,
              PMR.CONTENIDO_PRESENTACION,
              PMR.CONTENIDO_NOMBRE_POLIZA,
              PMR.CONTENIDO_N_POLIZA,
              PMR.CONTENIDO_CONEXION,
              PMR.CONTENIDO_VIGENCIA_INI,
              PMR.CONTENIDO_VIGENCIA_FIN,
              PMR.CONTENIDO_CONECTOR_VIGENCIA,
              PMR.CONTENIDO_COMPLEMENTO,
              PMR.CONTENIDO_NOMBRE,
              PMR.CONTENIDO_NUMERO,
              PMR.CONTENIDO_PRIMA_ANTERIOR,
              PMR.CONTENIDO_PRIMA_ACTUAL,
              PMR.CONTENIDO_INICIO_VIGENCIA,
              PMR.CONTENIDO_FIN_VIGENCIA,
              PMR.CONTENIDO_INTRO,
              PMR.CONTENIDO_FORMA_PAGO,
              PMR.CONTENIDO_CONECTOR,
              PMR.CONTENIDO_CUOTA_ACTUAL,
              PMR.CONTENIDO_COMERCIAL_1,
              PMR.CONTENIDO_COMERCIAL_2,
              PMR.CONTENIDO_INVITACION,
              PMR.CONTENIDO_BENEFICIO_1,
              PMR.CONTENIDO_BENEFICIO_2,
              PMR.CONTENIDO_BENEFICIO_3,
              PMR.CONTENIDO_BENEFICIO_4,
              PMR.CONTENIDO_EVENTUALIDAD,
              PMR.CONTENIDO_MEDIO,
              PMR.CONTENIDO_DIGITAL,
              PMR.CONTENIDO_BANCARIO,
              PMR.CONTENIDO_CIERRE,
              PMR.CONTENIDO_DESPEDIDA,
              PMR.CONTENIDO_TABLA,
              PMR.FECHA_ACTUALIZACION,
              PMR.ASUNTO_PLACA,
              PMR.CONTENIDO_RAMO,
              PMR.CONTENIDO_REFERENCIA,
              PMR.CONTENIDO_RECORDATORIO,
              PMR.CONTENIDO_PASOS,
              PMR.CONTENIDO_PASO_1,
              PMR.CONTENIDO_PASO_2,
              PMR.CONTENIDO_PASO_3,
              PMR.CONTENIDO_PASO_4,
              PMR.CONTENIDO_PASO_5
          FROM 
              SISTEMA.CONFIGURACION_GENERAL_RENOVACION CGR 
                  INNER JOIN RENOVACION.ENVIO_RENOVACION_GENERAL ERG ON ERG.ID_ENVIO_RENOVACION_GENERAL = CGR.ID_ENVIO_RENOVACION_GENERAL
                      INNER JOIN SISTEMA.TIPO_RAMO TR ON TR.ID_TIPO_RAMO = ERG.ID_TIPO_RAMO 
                          INNER JOIN NEGOCIO.RAMOS R ON R.ID_RAMO =  TR.ID_RAMO 
                      INNER JOIN RENOVACION.PLANTILLA_ENVIO_RENOVACION PER ON PER.ID_ENVIO_RENOVACION_GENERAL = ERG.ID_ENVIO_RENOVACION_GENERAL 
                          INNER JOIN RENOVACION.PLANTILLA_MAIL_RENOVACION PMR ON PMR.ID_PLANTILLA_MAIL_RENOVACION = PER.ID_PLANTILLA_MAIL_RENOVACION 
          WHERE
              CGR.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    res.json([dias.rows, mensajes.rows])
}

export const cargarInfoRenovacion = async (req, res) => {
    const { id_asesor, mes } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const mesComun = await pool.query(
        `
          SELECT 
              P.ID_POLIZA,
              P.NOMBRE_POLIZA, 
              P.NUMERO, 
              P.ID_TOMADOR,
              (PE.NOMBRE || ' ' || PE.PRIMER_APELLIDO) AS NOMBRE_TOMADOR,
              PE.DNI AS DNI_TOMADOR,
              P.ID_ASESOR,
              PE2.NOMBRE AS NOMBRE_ASESOR,
              P.FECHA_EXPEDICION,
              P.FECHA_FIN_VIGENCIA,
              TR.ID_TIPO_RAMO,
              R.ID_TIPO_ESTADO,
              TE.DESCRIPCION AS DESCRIPCION_ESTADO,
              P.VALOR_PRIMA_ANTERIOR,
              P.VALOR_PRIMA_ACTUAL,
              P.VALOR_CUOTA_ANTERIOR,
              P.VALOR_CUOTA_ACTUAL 
          FROM 
              RENOVACION.RENOVACIONES R 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = R.ID_TIPO_ESTADO 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = R.ID_POLIZA 
                      INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = P.ID_TOMADOR 
                          INNER JOIN "general".PERSONAS PE ON PE.ID_PERSONA = T.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI ON TDNI.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN NEGOCIO.ASESORES A ON A.ID_ASESOR = P.ID_ASESOR 
                          INNER JOIN "general".PERSONAS PE2 ON PE2.ID_PERSONA = A.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI2 ON TDNI2.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN SISTEMA.TIPO_RAMO TR ON TR.ID_TIPO_RAMO = P.ID_TIPO_RAMO
          WHERE 
              EXTRACT(MONTH FROM P.FECHA_FIN_VIGENCIA) = $1
              AND EXTRACT(YEAR FROM P.FECHA_EXPEDICION) < EXTRACT(YEAR FROM CURRENT_DATE)
              AND TR.ID_TIPO_RAMO <> 32
              AND P.ID_ASESOR = $2
      `,
        [mes, id_asesor]
    )

    const cabecera = await pool.query(
        `
          SELECT 
              COUNT(P.ID_TOMADOR) AS CLIENTES,
              SUM(P.VALOR_PRIMA_ACTUAL) PRIMA_TOTAL
          FROM 
              RENOVACION.RENOVACIONES R
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = R.ID_POLIZA 
          WHERE 
              P.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    res.json([mesComun.rows, cabecera.rows]) //, mesAnterior.rows, mesActual.rows, mesSiguiente.rows, cabecera.rows]);
}

export const cargarInfoClienteRenovacion = async (req, res) => {
    const { id_asesor, id_tomador } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const registros = await pool.query(
        `
          SELECT 
              P.ID_POLIZA,
              P.NOMBRE_POLIZA, 
              P.NUMERO, 
              P.ID_TOMADOR,
              PE.NOMBRE AS NOMBRE_TOMADOR,
              PE.DNI AS DNI_TOMADOR,
              P.ID_ASESOR,
              PE2.NOMBRE AS NOMBRE_ASESOR,
              P.FECHA_EXPEDICION,
              P.FECHA_FIN_VIGENCIA,
              TR.ID_TIPO_RAMO,
              R.ID_TIPO_ESTADO,
              TE.DESCRIPCION AS DESCRIPCION_ESTADO,
              P.VALOR_PRIMA_ANTERIOR,
              P.VALOR_PRIMA_ACTUAL,
              P.VALOR_CUOTA_ANTERIOR,
              P.VALOR_CUOTA_ACTUAL 
          FROM 
              RENOVACION.RENOVACIONES R 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = R.ID_TIPO_ESTADO 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = R.ID_POLIZA 
                      INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = P.ID_TOMADOR 
                          INNER JOIN "general".PERSONAS PE ON PE.ID_PERSONA = T.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI ON TDNI.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN NEGOCIO.ASESORES A ON A.ID_ASESOR = P.ID_ASESOR 
                          INNER JOIN "general".PERSONAS PE2 ON PE2.ID_PERSONA = A.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI2 ON TDNI2.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN SISTEMA.TIPO_RAMO TR ON TR.ID_TIPO_RAMO = P.ID_TIPO_RAMO
          WHERE 
              P.ID_TOMADOR = $1
              AND P.ID_ASESOR = $2
      `,
        [id_asesor, id_tomador]
    )

    const cabecera = await pool.query(
        `
          SELECT 
              PE.NOMBRE,
              (TDNI.ALIAS || ' ' || PE.DNI) DOCUMENTO,
              TDNI.ID_TIPO_DNI,
              SUM(P.VALOR_PRIMA_ACTUAL) POLIZA
          FROM 
              RENOVACION.RENOVACIONES R 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = R.ID_TIPO_ESTADO 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = R.ID_POLIZA 
                      INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = P.ID_TOMADOR 
                          INNER JOIN "general".PERSONAS PE ON PE.ID_PERSONA = T.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI ON TDNI.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN NEGOCIO.ASESORES A ON A.ID_ASESOR = P.ID_ASESOR 
                          INNER JOIN "general".PERSONAS PE2 ON PE2.ID_PERSONA = A.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI2 ON TDNI2.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN SISTEMA.TIPO_RAMO TR ON TR.ID_TIPO_RAMO = P.ID_TIPO_RAMO
          WHERE 
              P.ID_TOMADOR = $1
              AND P.ID_ASESOR = $2
          GROUP BY 
              PE.NOMBRE,
              TDNI.ALIAS,
              PE.DNI,
              TDNI.ID_TIPO_DNI
      `,
        [id_asesor, id_tomador]
    )

    res.json([registros.rows, cabecera.rows])
}

export const cargarInfoGestionRenovacion = async (req, res) => {
    const { id_poliza } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const mails = await pool.query(
        `
          SELECT
              N.ID_NOTIFICACION,
              N.ASUNTO_NOTIFICACION, 
              N.CONTENIDO_NOTIFICACION,
              N.ID_TIPO_PROCESO_NOTIFICACION,
              N.FECHA_NOTIFICACION 
          FROM 
              "general".NOTIFICACIONES N 
                  INNER JOIN SISTEMA.TIPO_PROCESO_NOTIFICACION TPN ON TPN.ID_TIPO_PROCESO_NOTIFICACION = N.ID_TIPO_PROCESO_NOTIFICACION 
                  INNER JOIN SISTEMA.TIPO_NOTIFICACION TN ON TN.ID_TIPO_NOTIFICACION = N.ID_TIPO_NOTIFICACION 
                  INNER JOIN NEGOCIO.NOTIFICACIONES_POLIZAS NP ON NP.ID_NOTIFICACION = N.ID_NOTIFICACION 
                      INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = NP.ID_POLIZA 
          WHERE 
              P.ID_POLIZA = $1
              AND N.ID_TIPO_NOTIFICACION = 1
              AND N.ID_TIPO_PROCESO_NOTIFICACION = 2
      `,
        [id_poliza]
    )

    const cabecera = await pool.query(
        `
          SELECT 
              PE.NOMBRE,
              (TDNI.ALIAS || ' ' || PE.DNI) DOCUMENTO,
              TDNI.ID_TIPO_DNI,
              SUM(P.VALOR_PRIMA_ACTUAL) POLIZA
          FROM 
              RENOVACION.RENOVACIONES R 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = R.ID_TIPO_ESTADO 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = R.ID_POLIZA 
                      INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = P.ID_TOMADOR 
                          INNER JOIN "general".PERSONAS PE ON PE.ID_PERSONA = T.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI ON TDNI.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN NEGOCIO.ASESORES A ON A.ID_ASESOR = P.ID_ASESOR 
                          INNER JOIN "general".PERSONAS PE2 ON PE2.ID_PERSONA = A.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI2 ON TDNI2.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN SISTEMA.TIPO_RAMO TR ON TR.ID_TIPO_RAMO = P.ID_TIPO_RAMO
          WHERE 
              P.ID_POLIZA = $1
          GROUP BY 
              PE.NOMBRE,
              TDNI.ALIAS,
              PE.DNI,
              TDNI.ID_TIPO_DNI
      `,
        [id_poliza]
    )

    res.json([mails.rows, cabecera.rows])
}

export const cargarInfoPolizaRenovacion = async (req, res) => {
    const { id_poliza } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const mails = await pool.query(
        `
          SELECT 
              N.ID_NOTIFICACION AS ID_GESTION,
              N.ASUNTO_NOTIFICACION AS ASUNTO, 
              N.CONTENIDO_NOTIFICACION AS CONTENIDO,
              N.ID_TIPO_PROCESO_NOTIFICACION,
              N.FECHA_NOTIFICACION AS FECHA
          FROM GENERAL.NOTIFICACIONES N
                  INNER JOIN NEGOCIO.NOTIFICACIONES_POLIZAS NP ON N.ID_NOTIFICACION = NP.ID_NOTIFICACION
                      INNER JOIN NEGOCIO.POLIZAS P ON NP.ID_POLIZA = P.ID_POLIZA
                          INNER JOIN CARTERA.CARTERAS C ON P.ID_POLIZA = C.ID_POLIZA
          WHERE
              P.ID_POLIZA = $1
              AND N.ID_TIPO_NOTIFICACION = 1
              AND N.FECHA_NOTIFICACION >= DATE(NOW()) - INTERVAL '20 DAY'
      `,
        [id_poliza]
    )

    const whatsapp = await pool.query(
        `
          SELECT 
              N.ID_NOTIFICACION AS ID_GESTION,
              N.ASUNTO_NOTIFICACION AS ASUNTO, 
              N.CONTENIDO_NOTIFICACION AS CONTENIDO,
              N.ID_TIPO_PROCESO_NOTIFICACION,
              N.FECHA_NOTIFICACION AS FECHA
          FROM GENERAL.NOTIFICACIONES N
                  INNER JOIN NEGOCIO.NOTIFICACIONES_POLIZAS NP ON N.ID_NOTIFICACION = NP.ID_NOTIFICACION
                      INNER JOIN NEGOCIO.POLIZAS P ON NP.ID_POLIZA = P.ID_POLIZA
                          INNER JOIN CARTERA.CARTERAS C ON P.ID_POLIZA = C.ID_POLIZA
          WHERE
              P.ID_POLIZA = $1
              AND N.ID_TIPO_NOTIFICACION = 2
              AND N.FECHA_NOTIFICACION >= DATE(NOW()) - INTERVAL '20 DAY'
      `,
        [id_poliza]
    )

    const cabecera = await pool.query(
        `
          SELECT 
              PE.NOMBRE,
              P.NUMERO,
              P.NOMBRE_POLIZA,
              (TDNI.ALIAS || ' ' || PE.DNI) DOCUMENTO,
              TDNI.ID_TIPO_DNI,
              R.VALOR_RENOVADO,
              R.FECHA_ACTUALIZACION 
          FROM 
              RENOVACION.RENOVACIONES R 
                  INNER JOIN SISTEMA.TIPO_ESTADO TE ON TE.ID_TIPO_ESTADO = R.ID_TIPO_ESTADO 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_POLIZA = R.ID_POLIZA 
                      INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = P.ID_TOMADOR 
                          INNER JOIN "general".PERSONAS PE ON PE.ID_PERSONA = T.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI ON TDNI.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN NEGOCIO.ASESORES A ON A.ID_ASESOR = P.ID_ASESOR 
                          INNER JOIN "general".PERSONAS PE2 ON PE2.ID_PERSONA = A.ID_PERSONA 
                              INNER JOIN SISTEMA.TIPO_DNI TDNI2 ON TDNI2.ID_TIPO_DNI = PE.TIPO_DNI 
                      INNER JOIN SISTEMA.TIPO_RAMO TR ON TR.ID_TIPO_RAMO = P.ID_TIPO_RAMO
          WHERE 
              R.ID_POLIZA = $1
      `,
        [id_poliza]
    )

    const detalle = await pool.query(
        `
          SELECT 
              P.CARATULA_ANTERIOR,
              P.CARATULA_ACTUAL 
          FROM
              NEGOCIO.POLIZAS P 
          WHERE 
              P.ID_POLIZA = $1
      `,
        [id_poliza]
    )

    res.json({
        mails: mails.rows,
        whatsapp: whatsapp.rows,
        cabecera: cabecera.rows,
        detalle: detalle.rows,
    })
}

export const cargarInfoClientes = async (req, res) => {
    const { id_asesor } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const activos = await pool.query(
        `SELECT
              TA.ID_TOMADOR,
              PZ.ID_ASESOR,
              P.TIPO_DNI AS ID_TIPO_DNI,
              (P.NOMBRE || ' ' || P.PRIMER_APELLIDO) AS NOMBRE,
              (TD.ALIAS || ' ' || P.DNI) AS CEDULA,
              P.CELULAR,
              P.EMAIL,
              (
                  CASE 
                      WHEN PZ.ID_ASESOR = $1 THEN COUNT(PZ.ID_POLIZA) ELSE 0
                  END	
              ) NUM_POLIZAS_TOMADOR
          FROM
              NEGOCIO.TOMADORES T
                  INNER JOIN NEGOCIO.POLIZAS PZ ON PZ.ID_TOMADOR = T.ID_TOMADOR 
                  INNER JOIN "general".PERSONAS P 
                  ON P.ID_PERSONA = T.ID_PERSONA
                      INNER JOIN SISTEMA.TIPO_DNI TD ON TD.ID_TIPO_DNI = P.TIPO_DNI
                      INNER JOIN NEGOCIO.TOMADORES_ASESORES TA ON TA.ID_TOMADOR = T.ID_TOMADOR
          WHERE
              TA.ID_ASESOR = $2
              AND T.ACTIVO = 'S'
          GROUP BY 
              TA.ID_TOMADOR,
              PZ.ID_ASESOR, 
              P.TIPO_DNI,
              P.NOMBRE,
              P.PRIMER_APELLIDO,
              TD.ALIAS,
              P.DNI,
              P.CELULAR,
              P.EMAIL`,
        [id_asesor, id_asesor]
    )

    const inactivos = await pool.query(
        `SELECT
              TA.ID_TOMADOR,
              PZ.ID_ASESOR,
              P.TIPO_DNI AS ID_TIPO_DNI,
              (P.NOMBRE || ' ' || P.PRIMER_APELLIDO) AS NOMBRE,
              (TD.ALIAS || ' ' || P.DNI) AS CEDULA,
              P.CELULAR,
              P.EMAIL,
              (
                  CASE 
                      WHEN PZ.ID_ASESOR = $1 THEN COUNT(PZ.ID_POLIZA) ELSE 0
                  END	
              ) NUM_POLIZAS_TOMADOR
          FROM
              NEGOCIO.TOMADORES T
                  INNER JOIN NEGOCIO.POLIZAS PZ ON PZ.ID_TOMADOR = T.ID_TOMADOR 
                  INNER JOIN "general".PERSONAS P 
                  ON P.ID_PERSONA = T.ID_PERSONA
                      INNER JOIN SISTEMA.TIPO_DNI TD ON TD.ID_TIPO_DNI = P.TIPO_DNI
                      INNER JOIN NEGOCIO.TOMADORES_ASESORES TA ON TA.ID_TOMADOR = T.ID_TOMADOR
          WHERE
              TA.ID_ASESOR = $2
              AND T.ACTIVO = 'N'
          GROUP BY 
              TA.ID_TOMADOR,
              PZ.ID_ASESOR, 
              P.TIPO_DNI,
              P.NOMBRE,
              P.PRIMER_APELLIDO,
              TD.ALIAS,
              P.DNI,
              P.CELULAR,
              P.EMAIL`,
        [id_asesor, id_asesor]
    )

    const polizas = await pool.query(
        `
          SELECT
              P.ID_TOMADOR,
              P.ID_POLIZA,
              P.ACTIVO,
              P.NOMBRE_POLIZA 
          FROM 
              NEGOCIO.POLIZAS P
          WHERE 
              P.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    const cabecera = await pool.query(
        `
          SELECT
              TO_CHAR(MAX(T.FECHA_ACTUALIZACION), 'DD TMMon YYYY') AS FECHA
          FROM NEGOCIO.TOMADORES T
                  INNER JOIN NEGOCIO.POLIZAS P ON T.ID_TOMADOR = P.ID_TOMADOR
                  INNER JOIN NEGOCIO.TOMADORES_ASESORES TA ON T.ID_TOMADOR = TA.ID_TOMADOR
          WHERE TA.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    res.json([activos.rows, inactivos.rows, polizas.rows, cabecera.rows])
}

export const cargarInfoAseguradosCliente = async (req, res) => {
    const { id_asesor, id_tomador, id_poliza } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const registros = await pool.query(
        `
          SELECT 	
              P.NOMBRE_POLIZA,
              P.NUMERO,
              P.ACTIVO AS ESTADO,
              TO_CHAR(MAX(P.FECHA_INICIO_VIGENCIA), 'DD-MM-YYYY') AS FECHA
          FROM 
              NEGOCIO.POLIZAS P 
          WHERE 
              P.ID_ASESOR = $1
              AND P.ID_TOMADOR = $2
              AND P.ID_POLIZA = $3 
          GROUP BY 
              P.NOMBRE_POLIZA,
              P.NUMERO,
              P.ACTIVO 
      `,
        [id_asesor, id_tomador, id_poliza]
    )

    const cabecera = await pool.query(
        `
          SELECT
              T.ID_TOMADOR,
              P.TIPO_DNI AS ID_TIPO_DNI, 
              (P.NOMBRE || ' ' || P.PRIMER_APELLIDO) AS NOMBRE,
              (TD.ALIAS || ' ' || P.DNI) AS DOCUMENTO,
              PO.VALOR_PRIMA_ACTUAL AS POLIZA,
              TO_CHAR(MAX(PO.FECHA_ACTUALIZACION), 'DD TMMon YYYY') AS FECHA
          FROM 
              NEGOCIO.POLIZAS PO 
                  INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = PO.ID_TOMADOR 
                      INNER JOIN GENERAL.PERSONAS P ON P.ID_PERSONA = T.ID_PERSONA 
                      INNER JOIN SISTEMA.TIPO_DNI TD ON TD.ID_TIPO_DNI = P.TIPO_DNI 
          WHERE 	
              PO.ID_ASESOR = $1
              AND PO.ID_TOMADOR = $2
              AND PO.ID_POLIZA = $3
          GROUP BY
              T.ID_TOMADOR,
              P.NOMBRE,
              P.PRIMER_APELLIDO,
              P.TIPO_DNI,
              TD.ALIAS,
              P.DNI,
              PO.VALOR_PRIMA_ACTUAL
      `,
        [id_asesor, id_tomador, id_poliza]
    )

    const asegurados = await pool.query(
        `
          SELECT 
              A.ID_ASEGURADO,
              P.ID_PERSONA,
              (P.NOMBRE || ' ' || P.PRIMER_APELLIDO) AS NOMBRE,
              TD.ID_TIPO_DNI,
              (TD.ALIAS || ' ' || P.DNI) CEDULA,
              P.CELULAR,
              P.EMAIL 
          FROM 
              NEGOCIO.ASEGURADOS A 
                  INNER JOIN NEGOCIO.POLIZAS_ASEGURADOS PA ON PA.ID_ASEGURADO = A.ID_ASEGURADO 
                  INNER JOIN "general".PERSONAS P ON P.ID_PERSONA = A.ID_PERSONA 
                      INNER JOIN SISTEMA.TIPO_DNI TD ON TD.ID_TIPO_DNI = P.TIPO_DNI 
          WHERE 
              PA.ID_POLIZA = $1
      `,
        [id_poliza]
    )

    /*     const familias = await pool.query(`
          SELECT 
              fa.id_asegurado,
              fa.nombre_familia,
              (td.alias_tipo_dni || ' ' || fa.dni_familia) AS cedula
          FROM familias_afiliados AS fa 
          INNER JOIN tipos_dni AS td ON td.id_tipo_dni = fa.id_tipo_dni 
          WHERE fa.id_poliza = $1
      `,[id_poliza]); */

    const detalle = await pool.query(
        `
              SELECT
                  P.CARATULA_ACTUAL CARATULAS
              FROM
                  NEGOCIO.POLIZAS P
              WHERE
                  P.ID_ASESOR = $1
                  AND P.ID_TOMADOR = $2
                  AND P.ID_POLIZA = $3
              UNION
              SELECT
                  P.CARATULA_ANTERIOR CARATULAS
              FROM
                  NEGOCIO.POLIZAS P
              WHERE
                  P.ID_ASESOR = $1
                  AND P.ID_TOMADOR = $2
                  AND P.ID_POLIZA = $3
      `,
        [id_asesor, id_tomador, id_poliza]
    )

    res.json([registros.rows, cabecera.rows, asegurados.rows, detalle.rows])
}

export const actualizarAseguradosCliente = async (req, res) => {
    const { id_asegurado, cel_asegurado, mail_asegurado } = req.body

    const registroPersona = await pool.query(
        `
          UPDATE 
              "general".PERSONAS P 
          SET
              P.CELULAR = $2
              P.EMAIL = $3
              P.FECHA_ACTUALIZACION = NOW() 
          WHERE 
              P.ID_PERSONA = $1
      `,
        [id_asegurado, cel_asegurado, mail_asegurado]
    )

    const registroAsegurado = await pool.query(
        `
          UPDATE 
              NEGOCIO.ASEGURADOS A
          SET
              A.FECHA_ACTUALIZACION = NOW() 
          WHERE 
              A.ID_ASEGURADO = $1	
      `,
        [id_asegurado]
    )

    res.json({
        msg: 'Registro asegurado actualizado exitosamente!!',
    })
}

/* export const cargarInfoPolizaCliente = async (req, res) => {
      const { id_asesor, id_tomador, id_poliza } = req.body;
  
      pool.query(`set lc_time='es_ES.UTF-8';`);
  
      const poliza = await pool.query(`
          SELECT 	
              P.NOMBRE_POLIZA,
              P.NUMERO,
              P.ACTIVO AS ESTADO,
              TO_CHAR(MAX(P.FECHA_INICIO_VIGENCIA), 'DD-MM-YYYY') AS FECHA
          FROM 
              NEGOCIO.POLIZAS P 
          WHERE 
              P.ID_ASESOR = $1
              AND P.ID_TOMADOR = $2
              AND P.ID_POLIZA = $3 
          GROUP BY 
              P.NOMBRE_POLIZA,
              P.NUMERO,
              P.ACTIVO 
      `,[id_asesor, id_tomador, id_poliza]);
  
      const cabecera = await pool.query(`
          SELECT
              T.ID_TOMADOR,
              P.TIPO_DNI AS ID_TIPO_DNI, 
              (P.NOMBRE || ' ' || P.PRIMER_APELLIDO) AS NOMBRE,
              (TD.ALIAS || ' ' || P.DNI) AS DOCUMENTO,
              PO.VALOR_PRIMA_ACTUAL AS POLIZA,
              TO_CHAR(MAX(PO.FECHA_ACTUALIZACION), 'DD TMMon YYYY') AS FECHA
          FROM 
              NEGOCIO.POLIZAS PO 
                  INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = PO.ID_TOMADOR 
                      INNER JOIN GENERAL.PERSONAS P ON P.ID_PERSONA = T.ID_PERSONA 
                      INNER JOIN SISTEMA.TIPO_DNI TD ON TD.ID_TIPO_DNI = P.TIPO_DNI 
          WHERE 	
              PO.ID_ASESOR = $1
              AND PO.ID_TOMADOR = $2
              AND PO.ID_POLIZA = $3
          GROUP BY
              T.ID_TOMADOR,
              P.NOMBRE,
              P.PRIMER_APELLIDO,
              P.TIPO_DNI,
              TD.ALIAS,
              P.DNI,
              PO.VALOR_PRIMA_ACTUAL
      `,[id_asesor, id_tomador, id_poliza]);
  
      const detalle = await pool.query(`
          SELECT 
              P.CARATULA_ACTUAL,
              P.CARATULA_ANTERIOR 
          FROM 
              NEGOCIO.POLIZAS P 
          WHERE 
              P.ID_ASESOR = $1
              AND P.ID_TOMADOR = $2
              AND P.ID_POLIZA = $3
      `,[id_asesor, id_tomador, id_poliza]);
      
  
      res.json([cabecera.rows, poliza.rows, detalle.rows]);
  }; */

export const cargarInfoSolicitudes = async (req, res) => {
    const { id_asesor } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const resueltos = await pool.query(
        `
          SELECT 
              s.id_solicitud, 
              t.id_tomador,
              t.id_tipo_dni,
              t.nombre_tomador AS nombre,
              (td.alias_tipo_dni || ' ' || t.dni_tomador) AS documento,
              ts.alias_solicitud AS tipo_solicitud,
              p.nombre_poliza AS poliza,
              p.numero_poliza AS n_poliza,
              TO_CHAR(MAX(s.fecha_actualizacion), 'DD/TMMonth/YYYY') AS fecha,
              COUNT(s.id_solicitud) AS total
          FROM solicitudes AS s 
          INNER JOIN tipo_solicitudes AS ts ON ts.id_tipo_solicitud = s.id_tipo_solicitud
          INNER JOIN tomadores AS t ON t.id_tomador = s.id_tomador
          INNER JOIN tipos_dni AS td ON td.id_tipo_dni = t.id_tipo_dni
          LEFT JOIN polizas AS p ON p.id_poliza = s.id_poliza
          LEFT JOIN asegurados AS a ON a.id_asegurado = s.id_asegurado
          WHERE s.id_asesor = $1 AND s.id_estado_solicitud = 11
          GROUP BY (s.id_solicitud, t.id_tipo_dni, t.nombre_tomador, td.alias_tipo_dni, t.dni_tomador, 
              ts.alias_solicitud, p.nombre_poliza, p.numero_poliza, t.id_tomador) 
          ORDER BY s.fecha_actualizacion DESC
      `,
        [id_asesor]
    )

    const en_proceso = await pool.query(
        `
          SELECT 
              s.id_solicitud, 
              t.id_tomador,
              t.id_tipo_dni,
              t.nombre_tomador AS nombre,
              (td.alias_tipo_dni || ' ' || t.dni_tomador) AS documento,
              ts.alias_solicitud AS tipo_solicitud,
              es.descripcion_estado AS estado,
              p.nombre_poliza AS poliza,
              p.numero_poliza AS n_poliza,
              TO_CHAR(MAX(s.fecha_actualizacion), 'DD/TMMonth/YYYY') AS fecha,
              COUNT(s.id_solicitud) AS total
          FROM solicitudes AS s 
          INNER JOIN estados_solicitudes AS es ON es.id_estado_solicitud = s.id_estado_solicitud
          INNER JOIN tipo_solicitudes AS ts ON ts.id_tipo_solicitud = s.id_tipo_solicitud
          INNER JOIN tomadores AS t ON t.id_tomador = s.id_tomador
          INNER JOIN tipos_dni AS td ON td.id_tipo_dni = t.id_tipo_dni
          LEFT JOIN polizas AS p ON p.id_poliza = s.id_poliza
          LEFT JOIN asegurados AS a ON a.id_asegurado = s.id_asegurado
          WHERE s.id_asesor = $1 AND s.id_estado_solicitud <> 11
          GROUP BY (s.id_solicitud, t.id_tipo_dni, t.nombre_tomador, td.alias_tipo_dni, t.dni_tomador, 
              ts.alias_solicitud, es.descripcion_estado, p.nombre_poliza, p.numero_poliza, t.id_tomador) 
          ORDER BY s.fecha_actualizacion DESC
      `,
        [id_asesor]
    )

    const tipo_solicitudes = await pool.query(`
          SELECT * FROM tipo_solicitudes 
      `)
    const tomadores = await pool.query(
        `
          SELECT 
              t.id_tomador,
              t.nombre_tomador 
          FROM tomadores AS t 
          INNER JOIN tomadores_asesores AS ta ON ta.id_tomador = t.id_tomador 
          WHERE ta.id_asesor = $1 
      `,
        [id_asesor]
    )
    const departamentos = await pool.query(`
          SELECT * FROM departamentos 
      `)
    const ciudades = await pool.query(`
          SELECT * FROM ciudades 
      `)
    const tipos_dni = await pool.query(`
          SELECT id_tipo_dni, (alias_tipo_dni || ' - ' || descripcion_tipo_dni) AS descripcion FROM tipos_dni 
      `)
    const generos = await pool.query(`
          SELECT * FROM generos 
      `)
    const ramos = await pool.query(`
          SELECT * FROM ramos 
      `)
    const bancos = await pool.query(`
          SELECT * FROM bancos 
      `)

    const encabezado = await pool.query(
        `
          SELECT 
              TO_CHAR(MAX(s.fecha_actualizacion), 'DD TMMon YYYY') AS fecha 
          FROM solicitudes AS s 
          WHERE s.id_asesor = $1
      `,
        [id_asesor]
    )

    res.json([
        resueltos.rows,
        en_proceso.rows,
        tipo_solicitudes.rows,
        tomadores.rows,
        departamentos.rows,
        ciudades.rows,
        tipos_dni.rows,
        generos.rows,
        ramos.rows,
        bancos.rows,
        encabezado.rows,
    ])
}

export const cargarInfoSolicitudDetalle = async (req, res) => {
    const { id_solicitud } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const cabecera = await pool.query(
        `
          SELECT 
              p.id_solicitud, 
              t.nombre_tomador AS nombre, 
              (td.alias_tipo_dni || ' ' || t.dni_tomador) AS documento, 
              td.id_tipo_dni, 
              p.id_tipo_solicitud, 
              ts.alias_solicitud, 
              a.nombre_asegurado, 
              es.descripcion_estado, 
              pl.nombre_poliza, 
              pl.numero_poliza, 
              TO_CHAR(MAX(p.fecha_actualizacion), 'DD TMMonth YYYY') AS fecha
          FROM solicitudes AS p 
          INNER JOIN tipo_solicitudes AS ts ON ts.id_tipo_solicitud = p.id_tipo_solicitud 
          INNER JOIN estados_solicitudes AS es ON es.id_estado_solicitud = p.id_estado_solicitud 
          INNER JOIN tomadores AS t ON t.id_tomador = p.id_tomador 
          INNER JOIN tipos_dni AS td ON td.id_tipo_dni = t.id_tipo_dni 
          LEFT JOIN polizas AS pl ON pl.id_poliza = p.id_poliza 
          LEFT JOIN asegurados AS a ON a.id_asegurado = p.id_asegurado 
          WHERE p.id_solicitud = $1 
          GROUP BY (p.id_solicitud, t.nombre_tomador, ts.alias_solicitud, es.descripcion_estado, td.alias_tipo_dni, 
              pl.nombre_poliza, a.nombre_asegurado, p.id_tipo_solicitud, pl.numero_poliza, t.dni_tomador, td.id_tipo_dni)
      `,
        [id_solicitud]
    )

    const gestiones = await pool.query(
        `
          SELECT 
              g.id_gestion,
              sg.id_estado_solicitud,
              es.descripcion_estado,
              es.color,
              g.contenido_gestion,
              g.fecha_registro,
              s.id_poliza,
              s.id_tomador, 
              g.asunto_gestion AS asunto,
              TO_CHAR(g.fecha_gestion, 'DD/TMMon/YYYY') AS fecha
          FROM solicitudes AS s 
          INNER JOIN solicitudes_gestiones AS sg ON sg.id_solicitud = s.id_solicitud 
          INNER JOIN estados_solicitudes AS es ON es.id_estado_solicitud = sg.id_estado_solicitud 
          INNER JOIN gestiones AS g ON g.id_gestion = sg.id_gestion 
          WHERE s.id_solicitud = $1 
          ORDER BY g.fecha_gestion
      `,
        [id_solicitud]
    )

    var id_tipo_solicitud = cabecera.rows[0].id_tipo_solicitud
    let detalle = null

    if (id_tipo_solicitud === 1) {
        detalle = await pool.query(
            `
              SELECT * FROM sarlaft WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 2) {
        detalle = await pool.query(
            `
              SELECT * FROM pago_debito WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 3) {
        detalle = await pool.query(
            `
              SELECT * FROM periodicidad_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 4) {
        detalle = await pool.query(
            `
              SELECT * FROM cuotas_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 5) {
        detalle = await pool.query(
            `
              SELECT * FROM cancelar_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 6) {
        detalle = await pool.query(
            `
              SELECT * FROM caratula_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 7) {
        detalle = await pool.query(
            `
              SELECT * FROM certificado_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 8) {
        detalle = await pool.query(
            `
              SELECT * FROM correo_bienvenida WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 9) {
        detalle = await pool.query(
            `
              SELECT * FROM solicitar_financiacion WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 10) {
        detalle = await pool.query(
            `
              SELECT * FROM certificado_tributario WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 11) {
        detalle = await pool.query(
            `
              SELECT * FROM documentacion_negocios WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 12) {
        detalle = await pool.query(
            `
              SELECT * FROM asegurado_riesgos_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 13) {
        detalle = await pool.query(
            `
              SELECT * FROM retirar_asegurados WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 14) {
        detalle = await pool.query(
            `
              SELECT * FROM reembolso_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 15) {
        detalle = await pool.query(
            `
              SELECT * FROM incapacidad_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 16) {
        detalle = await pool.query(
            `
              SELECT * FROM rehabilitacion_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 17) {
        detalle = await pool.query(
            `
              SELECT * FROM datos_asegurados_polizas WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 18) {
        detalle = await pool.query(
            `
              SELECT * FROM beneficiario_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 19) {
        detalle = await pool.query(
            `
              SELECT * FROM cobertura_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 20) {
        detalle = await pool.query(
            `
              SELECT * FROM autorizacion_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    }

    const departamentos = await pool.query(`
          SELECT * FROM departamentos 
      `)
    const ciudades = await pool.query(`
          SELECT * FROM ciudades 
      `)
    const tipos_dni = await pool.query(`
          SELECT id_tipo_dni, (alias_tipo_dni || ' - ' || descripcion_tipo_dni) AS descripcion FROM tipos_dni 
      `)
    const generos = await pool.query(`
          SELECT * FROM generos 
      `)
    const ramos = await pool.query(`
          SELECT * FROM ramos 
      `)
    const bancos = await pool.query(`
          SELECT * FROM bancos 
      `)

    res.json([
        cabecera.rows,
        gestiones.rows,
        detalle.rows,
        departamentos.rows,
        ciudades.rows,
        tipos_dni.rows,
        generos.rows,
        ramos.rows,
        bancos.rows,
    ])
}

export const cargarInfoPolizaSolicitud = async (req, res) => {
    const { id_solicitud } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const cabecera = await pool.query(
        `
          SELECT 
              p.id_solicitud,
              t.nombre_tomador AS nombre,
              (td.alias_tipo_dni || ' ' || t.dni_tomador) AS documento, 
              td.id_tipo_dni,
              p.id_tipo_solicitud,
              ts.alias_solicitud,
              es.descripcion_estado,
              TO_CHAR(pl.fecha_actualizacion, 'DD/MM/YYYY') AS fecha_poliza, 
              pl.nombre_poliza,
              pl.numero_poliza,
              TO_CHAR(MAX(p.fecha_actualizacion), 'DD TMMon YYYY') AS fecha
          FROM solicitudes AS p 
          INNER JOIN tipo_solicitudes AS ts ON ts.id_tipo_solicitud = p.id_tipo_solicitud 
          INNER JOIN estados_solicitudes AS es ON es.id_estado_solicitud = p.id_estado_solicitud 
          INNER JOIN tomadores AS t ON t.id_tomador = p.id_tomador 
          INNER JOIN tipos_dni AS td ON td.id_tipo_dni = t.id_tipo_dni 
          INNER JOIN polizas AS pl ON pl.id_poliza = p.id_poliza 
          WHERE p.id_solicitud = $1 
          GROUP BY (p.id_solicitud, t.nombre_tomador, ts.alias_solicitud, es.descripcion_estado, td.alias_tipo_dni, 
              pl.nombre_poliza, pl.fecha_actualizacion, p.id_tipo_solicitud, pl.numero_poliza, t.dni_tomador, td.id_tipo_dni)
      `,
        [id_solicitud]
    )

    var id_tipo_solicitud = cabecera.rows[0].id_tipo_solicitud
    let detalle = null

    if (id_tipo_solicitud === 1) {
        detalle = await pool.query(
            `
              SELECT documento_persona_natural AS documento1, documento_persona_juridica AS documento2 FROM sarlaft WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 2) {
        detalle = await pool.query(
            `
              SELECT documento_carta_pago AS documento1 FROM pago_debito WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 3) {
        detalle = await pool.query(
            `
              SELECT documento_carta_periodicidad AS documento1 FROM periodicidad_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 5) {
        detalle = await pool.query(
            `
              SELECT documento_carta_cancelacion AS documento1, documento_paz_y_salvo AS documento2 FROM cancelar_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 8) {
        detalle = await pool.query(
            `
              SELECT documento_caratula_poliza AS documento1, documento_recibo_cobro AS documento2 FROM correo_bienvenida WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 9) {
        detalle = await pool.query(
            `
              SELECT documento_cuadro_financiacion AS documento1, documento_recibo_cobro AS documento2 FROM solicitar_financiacion WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 11) {
        detalle = await pool.query(
            `
              SELECT documento_sarlaft AS documento1, documento_firma_cliente AS documento2 FROM documentacion_negocios WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 12) {
        detalle = await pool.query(
            `
              SELECT documento_form_asegurabilidad AS documento1 FROM asegurado_riesgos_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 13) {
        detalle = await pool.query(
            `
              SELECT documento_carta_retiros AS documento1 FROM retirar_asegurados WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 14) {
        detalle = await pool.query(
            `
              SELECT documento_historial_clinico AS documento1, documento_factura AS documento2, documento_asistencia_terapias AS documento3 FROM reembolso_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 15) {
        detalle = await pool.query(
            `
              SELECT documento_historial_clinico AS documento1, documento_cert_incapacidad AS documento2 FROM incapacidad_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 16) {
        detalle = await pool.query(
            `
              SELECT documento_carta_rehab AS documento1, documento_decl_cliente AS documento2 FROM rehabilitacion_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 17) {
        detalle = await pool.query(
            `
              SELECT documentos_cliente AS documento1, documento_formato_correcion AS documento2 FROM datos_asegurados_polizas WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 18) {
        detalle = await pool.query(
            `
              SELECT documento_carta_cliente AS documento1 FROM beneficiario_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 20) {
        detalle = await pool.query(
            `
              SELECT documento_historial_clinico AS documento1, documento_rem_medica AS documento2 FROM autorizacion_poliza WHERE id_solicitud = $1
          `,
            [id_solicitud]
        )
    }

    res.json([cabecera.rows, detalle.rows])
}

export const guardarInfoSolicitud = async (req, res) => {
    const {
        documento1,
        documento2,
        documento3,
        id_tipo_solicitud,
        id_asesor,
        id_tomador,
        id_poliza,
        id_asegurado,
        nota,
        id_dept_nacimiento,
        id_ciudad_nacimiento,
        profesion,
        direccion_residencia,
        id_dept_residencia,
        id_ciudad_residencia,
        direccion_trabajo,
        id_dept_trabajo,
        id_ciudad_trabajo,
        ingreso_mensual,
        mail_asegurado,
        cambio_fecha,
        periocidad_nueva,
        numero_cuotas,
        fecha_cancelacion,
        nombre_representante_empresa,
        num_cuenta_devol,
        tipo_cuenta,
        banco,
        nombre_asegurado,
        id_tipo_asegurado,
        dni_asegurado,
        id_ramo,
        num_poliza,
        doc_solicitar,
        fecha_nacimiento,
        parentesco,
        eps,
        tipo_afiliado,
        peso,
        estatura,
        empresa_trabajo,
        fecha_ing_empresa,
        ocupacion,
        emi,
        sol_antiguedad,
        year_antiguedad,
        num_poliza_antiguedad,
        esp_medica_atendida,
        cant_sesiones,
        sesiones,
        fecha_factura,
        id_cuidad_atencion,
        numero_factura,
        valor_factura,
        fecha_ini_incapacidad,
        fecha_fin_incapacidad,
        cod_diagnostico,
        tipo_cobertura,
        tipo_reclamo,
        num_cuenta_indemnizacion,
        nombre_corregir,
        id_tipo_corregir,
        dni_corregir,
        id_genero_corregir,
        fecha_nacimiento_corregir,
        dir_residencia_corregir,
        cel_corregir,
        mail_corregir,
        nuevo_beneficiario,
        valor_asegurar,
        tipo_autorizacion,
        nombre_clinica,
    } = req.body

    const get_registro = await pool.query(`
          SELECT MAX(id_solicitud) + 1 AS id_solicitud FROM solicitudes
      `)

    const id_solicitud = get_registro.rows[0].id_solicitud

    const get_gestion = await pool.query(`
          SELECT MAX(id_gestion) + 1 AS id FROM gestiones
      `)

    const id_gestion = get_gestion.rows[0].id

    const general = await pool.query(
        `
          INSERT INTO 
              solicitudes 
          VALUES 
              ($1, $2, $3, $4, $5, $6, $7, 12, now(), now())
      `,
        [
            id_solicitud,
            id_asesor,
            id_tomador,
            id_poliza,
            id_asegurado,
            id_tipo_solicitud,
            nota,
        ]
    )

    const gestion = await pool.query(
        `
          INSERT INTO 
              gestiones 
          VALUES 
              ($1, $2, now(), NULL, NULL, now(), now(), NULL)
      `,
        [id_gestion, id_asesor]
    )

    const gestion_solicitud = await pool.query(
        `
          INSERT INTO 
              solicitudes_gestiones 
          VALUES 
              ($1, $2, 12)
      `,
        [id_solicitud, id_gestion]
    )

    if (id_tipo_solicitud === 1) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  sarlaft 
              VALUES ( 
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
              )
          `,
            [
                id_solicitud,
                id_dept_nacimiento,
                id_ciudad_nacimiento,
                profesion,
                direccion_residencia,
                id_dept_residencia,
                id_ciudad_residencia,
                direccion_trabajo,
                id_dept_trabajo,
                id_ciudad_trabajo,
                ingreso_mensual,
                mail_asegurado,
                documento1,
                documento2,
            ]
        )
    } else if (id_tipo_solicitud === 2) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  pago_debito 
              VALUES ( 
                  $1, $2, $3, $4
              )
          `,
            [id_solicitud, cambio_fecha, mail_asegurado, documento1]
        )
    } else if (id_tipo_solicitud === 3) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  periodicidad_poliza 
              VALUES ( 
                  $1, $2, $3, $4
              )
          `,
            [id_solicitud, periocidad_nueva, mail_asegurado, documento1]
        )
    } else if (id_tipo_solicitud === 4) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  cuotas_poliza 
              VALUES ( 
                  $1, $2, $3
              )
          `,
            [id_solicitud, numero_cuotas, mail_asegurado]
        )
    } else if (id_tipo_solicitud === 5) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  cancelar_poliza 
              VALUES ( 
                  $1, $2, $3, $4, $5, $6, $7, $8, $9
              )
          `,
            [
                id_solicitud,
                fecha_cancelacion,
                mail_asegurado,
                nombre_representante_empresa,
                num_cuenta_devol,
                tipo_cuenta,
                banco,
                documento1,
                documento2,
            ]
        )
    } else if (id_tipo_solicitud === 6) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  caratula_poliza 
              VALUES ( 
                  $1, $2
              )
          `,
            [id_solicitud, mail_asegurado]
        )
    } else if (id_tipo_solicitud === 7) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  certificado_poliza 
              VALUES ( 
                  $1, $2
              )
          `,
            [id_solicitud, mail_asegurado]
        )
    } else if (id_tipo_solicitud === 8) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  correo_bienvenida 
              VALUES ( 
                  $1, $2, $3, $4, $5, $6, $7, $8, $9
              )
          `,
            [
                id_solicitud,
                nombre_asegurado,
                id_tipo_asegurado,
                dni_asegurado,
                id_ramo,
                num_poliza,
                mail_asegurado,
                documento1,
                documento2,
            ]
        )
    } else if (id_tipo_solicitud === 9) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  solicitar_financiacion 
              VALUES ( 
                  $1, $2, $3, $4, $5
              )
          `,
            [
                id_solicitud,
                numero_cuotas,
                mail_asegurado,
                documento1,
                documento2,
            ]
        )
    } else if (id_tipo_solicitud === 10) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  certificado_tributario 
              VALUES ( 
                  $1, $2
              )
          `,
            [id_solicitud, mail_asegurado]
        )
    } else if (id_tipo_solicitud === 11) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  documentacion_negocios 
              VALUES ( 
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
              )
          `,
            [
                id_solicitud,
                doc_solicitar,
                nombre_asegurado,
                id_tipo_asegurado,
                dni_asegurado,
                id_ramo,
                num_poliza,
                mail_asegurado,
                documento1,
                documento2,
            ]
        )
    } else if (id_tipo_solicitud === 12) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  asegurado_riesgos_poliza 
              VALUES ( 
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
              )
          `,
            [
                id_solicitud,
                nombre_asegurado,
                id_tipo_asegurado,
                dni_asegurado,
                fecha_nacimiento,
                parentesco,
                eps,
                tipo_afiliado,
                peso,
                estatura,
                direccion_residencia,
                empresa_trabajo,
                fecha_ing_empresa,
                ocupacion,
                emi,
                sol_antiguedad,
                year_antiguedad,
                num_poliza_antiguedad,
                mail_asegurado,
                documento1,
            ]
        )
    } else if (id_tipo_solicitud === 13) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  retirar_asegurados 
              VALUES ( 
                  $1, $2, $3, $4, $5, $6, $7
              )
          `,
            [
                id_solicitud,
                fecha_cancelacion,
                num_cuenta_devol,
                tipo_cuenta,
                banco,
                mail_asegurado,
                documento1,
            ]
        )
    } else if (id_tipo_solicitud === 14) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  reembolso_poliza 
              VALUES ( 
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
              )
          `,
            [
                id_solicitud,
                esp_medica_atendida,
                cant_sesiones,
                sesiones,
                fecha_factura,
                id_cuidad_atencion,
                numero_factura,
                valor_factura,
                mail_asegurado,
                documento1,
                documento2,
                documento3,
            ]
        )
    } else if (id_tipo_solicitud === 15) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  incapacidad_poliza 
              VALUES ( 
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
              )
          `,
            [
                id_solicitud,
                fecha_ini_incapacidad,
                fecha_fin_incapacidad,
                cod_diagnostico,
                tipo_cobertura,
                tipo_reclamo,
                num_cuenta_indemnizacion,
                tipo_cuenta,
                banco,
                mail_asegurado,
                documento1,
                documento2,
            ]
        )
    } else if (id_tipo_solicitud === 16) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  rehabilitacion_poliza 
              VALUES ( 
                  $1, $2, $3, $4
              )
          `,
            [id_solicitud, mail_asegurado, documento1, documento2]
        )
    } else if (id_tipo_solicitud === 17) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  datos_asegurados_polizas 
              VALUES ( 
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
              )
          `,
            [
                id_solicitud,
                nombre_corregir,
                id_tipo_corregir,
                dni_corregir,
                id_genero_corregir,
                fecha_nacimiento_corregir,
                dir_residencia_corregir,
                cel_corregir,
                mail_corregir,
                mail_asegurado,
                documento1,
                documento2,
            ]
        )
    } else if (id_tipo_solicitud === 18) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  beneficiario_poliza 
              VALUES ( 
                  $1, $2, $3, $4
              )
          `,
            [id_solicitud, nuevo_beneficiario, mail_asegurado, documento1]
        )
    } else if (id_tipo_solicitud === 19) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  cobertura_poliza 
              VALUES ( 
                  $1, $2, $3
              )
          `,
            [id_solicitud, valor_asegurar, mail_asegurado]
        )
    } else if (id_tipo_solicitud === 20) {
        const detalle = await pool.query(
            `
              INSERT INTO 
                  autorizacion_poliza 
              VALUES ( 
                  $1, $2, $3, $4, $5, $6
              )
          `,
            [
                id_solicitud,
                tipo_autorizacion,
                nombre_clinica,
                id_cuidad_atencion,
                documento1,
                documento2,
            ]
        )
    }

    res.json({
        msg: 'Registro nueva solicitud exitoso!!',
    })
}

export const eliminarSolicitud = async (req, res) => {
    const { id_solicitud } = req.body

    const cabecera = await pool.query(
        `
          SELECT 
              id_tipo_solicitud 
          FROM solicitudes 
          WHERE id_solicitud = $1
      `,
        [id_solicitud]
    )

    var id_tipo_solicitud = cabecera.rows[0].id_tipo_solicitud

    if (id_tipo_solicitud === 1) {
        await pool.query(`DELETE FROM sarlaft WHERE id_solicitud = $1`, [
            id_solicitud,
        ])
    } else if (id_tipo_solicitud === 2) {
        await pool.query(`DELETE FROM pago_debito WHERE id_solicitud = $1`, [
            id_solicitud,
        ])
    } else if (id_tipo_solicitud === 3) {
        await pool.query(
            `DELETE FROM periodicidad_poliza WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 4) {
        await pool.query(`DELETE FROM cuotas_poliza WHERE id_solicitud = $1`, [
            id_solicitud,
        ])
    } else if (id_tipo_solicitud === 5) {
        await pool.query(
            `DELETE FROM cancelar_poliza WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 6) {
        await pool.query(
            `DELETE FROM caratula_poliza WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 7) {
        await pool.query(
            `DELETE FROM certificado_poliza WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 8) {
        await pool.query(
            `DELETE FROM correo_bienvenida WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 9) {
        await pool.query(
            `DELETE FROM solicitar_financiacion WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 10) {
        await pool.query(
            `DELETE FROM certificado_tributario WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 11) {
        await pool.query(
            `DELETE FROM documentacion_negocios WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 12) {
        await pool.query(
            `DELETE FROM asegurado_riesgos_poliza WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 13) {
        await pool.query(
            `DELETE FROM retirar_asegurados WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 14) {
        await pool.query(
            `DELETE FROM reembolso_poliza WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 15) {
        await pool.query(
            `DELETE FROM incapacidad_poliza WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 16) {
        await pool.query(
            `DELETE FROM rehabilitacion_poliza WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 17) {
        await pool.query(
            `DELETE FROM datos_asegurados_polizas WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 18) {
        await pool.query(
            `DELETE FROM beneficiario_poliza WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 19) {
        await pool.query(
            `DELETE FROM cobertura_poliza WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    } else if (id_tipo_solicitud === 20) {
        await pool.query(
            `DELETE FROM autorizacion_poliza WHERE id_solicitud = $1`,
            [id_solicitud]
        )
    }

    await pool.query(`DELETE FROM solicitudes WHERE id_solicitud = $1`, [
        id_solicitud,
    ])

    await pool.query(
        `DELETE FROM solicitudes_gestiones WHERE id_solicitud = $1`,
        [id_solicitud]
    )

    res.json({
        msg: 'EliminaciOn de registro solicitud exitosa!!',
    })
}

export const cargarInfoPolizas = async (req, res) => {
    const { id_tomador } = req.body

    const registros = await pool.query(
        `
          SELECT 
              P.ID_POLIZA,
              P.NUMERO,
              (P.NUMERO || ' - ' || P.NOMBRE_POLIZA) DESCRIPCION
          FROM 
              NEGOCIO.POLIZAS P 
          WHERE 
              P.ID_TOMADOR = $1
      `,
        [id_tomador]
    )

    res.json([registros.rows])
}

export const cargarInfoAsegurados = async (req, res) => {
    const { id_poliza } = req.body

    const asegurados = await pool.query(
        `
          SELECT 
              t.id_asegurado,
              t.nombre_asegurado
          FROM asegurados AS t 
          INNER JOIN tipos_dni AS td ON td.id_tipo_dni = t.id_tipo_dni 
          WHERE t.id_poliza = $1
      `,
        [id_poliza]
    )

    res.json([asegurados.rows])
}

export const actualizarInfoContactoPersona = async (req, res) => {
    const { mail_contacto, celular, id_persona } = req.body

    const asegurados = await pool.query(
        `
          UPDATE GENERAL.PERSONAS
          SET 
              EMAIL= $1,
              CELULAR= $2,
          WHERE ID_PERSONA= $3
      `,
        [mail_contacto, celular, id_persona]
    )

    res.json('Información de contacto actualizada correctamente')
}

export const cargarInfoClienteDetalle = async (req, res) => {
    const { id_asesor, id_tomador } = req.body

    const activos = await pool.query(
        `
          SELECT
              P.ID_POLIZA,
              P.ID_TOMADOR,
              P.NOMBRE_POLIZA,
              P.NUMERO AS NUMERO_POLIZA,
              C.VALOR AS VALOR_CARTERA,
              P.VALOR_PRIMA_ACTUAL,
              C.IS_CARTERA_ESPECIAL,
              COUNT(PA.ID_POLIZA) ASEGURADOS,
              TO_CHAR(P.FECHA_INICIO_VIGENCIA, 'DD-MM-YYYY') AS FECHA 
          FROM 
              NEGOCIO.POLIZAS P 
                  LEFT JOIN CARTERA.CARTERAS C ON C.ID_POLIZA = P.ID_POLIZA 
                  LEFT JOIN NEGOCIO.POLIZAS_ASEGURADOS AS PA ON PA.ID_POLIZA = P.ID_POLIZA
          WHERE 
              P.ID_ASESOR = $1
              AND P.ID_TOMADOR = $2
              AND P.ACTIVO = 'S'
          GROUP BY 
              P.ID_POLIZA,
              P.ID_TOMADOR,
              P.NOMBRE_POLIZA,
              P.NUMERO,
              C.VALOR,
              C.IS_CARTERA_ESPECIAL,
              P.VALOR_PRIMA_ACTUAL
      `,
        [id_asesor, id_tomador]
    )

    const cancelados = await pool.query(
        `
          SELECT
              P.ID_POLIZA,
              P.ID_TOMADOR,
              P.NOMBRE_POLIZA,
              P.NUMERO AS NUMERO_POLIZA,
              C.VALOR AS VALOR_CARTERA,
              P.VALOR_PRIMA_ACTUAL,
              C.IS_CARTERA_ESPECIAL,
              COUNT(PA.ID_POLIZA) ASEGURADOS,
              TO_CHAR(P.FECHA_INICIO_VIGENCIA, 'DD-MM-YYYY') AS FECHA 
          FROM 
              NEGOCIO.POLIZAS P 
                  LEFT JOIN CARTERA.CARTERAS C ON C.ID_POLIZA = P.ID_POLIZA 
                  LEFT JOIN NEGOCIO.POLIZAS_ASEGURADOS AS PA ON PA.ID_POLIZA = P.ID_POLIZA
          WHERE 
              P.ID_ASESOR = $1
              AND P.ID_TOMADOR = $2
              AND P.ACTIVO = 'N'
          GROUP BY 
              P.ID_POLIZA,
              P.ID_TOMADOR,
              P.NOMBRE_POLIZA,
              P.NUMERO,
              C.VALOR,
              C.IS_CARTERA_ESPECIAL,
              P.VALOR_PRIMA_ACTUAL
      `,
        [id_asesor, id_tomador]
    )

    const contactos = await pool.query(
        `
          SELECT
              C.ID_CONTACTO,
              T.ID_TOMADOR,
              P.ID_PERSONA,
              PZ.ID_POLIZA,
              P.NOMBRE,
              P.PRIMER_APELLIDO,
              P.SEGUNDO_APELLIDO,
              P.EMAIL AS MAIL_CONTACTO,
              P.CELULAR,
              TP.ID_TIPO_CONTACTO,
              TP.DESCRIPCION AS TIPO_CONTACTO,
              P.ID_GENERO,
              TD.ID_TIPO_DNI,
              TD.ALIAS,
              P.DNI,
              ARRAY(
                  SELECT 
                      PZ.NOMBRE_POLIZA || ' - ' || PZ.NUMERO AS POLIZA
                  FROM NEGOCIO.TOMADORES T
                          INNER JOIN NEGOCIO.POLIZAS PZ ON T.ID_TOMADOR = PZ.ID_TOMADOR
                              INNER JOIN NEGOCIO.ASESORES A ON PZ.ID_ASESOR = A.ID_ASESOR
                  WHERE A.ID_ASESOR = $1 AND T.ID_TOMADOR = $2
              ) AS POLIZAS,
              TPN.ID_TIPO_PROCESO_NOTIFICACION,
              TPN.DESCRIPCION AS PROCESO_NOTIFICACION
          FROM NEGOCIO.CONTACTOS C 
                  INNER JOIN SISTEMA.TIPO_CONTACTO TP ON C.ID_TIPO_CONTACTO = TP.ID_TIPO_CONTACTO
                  INNER JOIN SISTEMA.TIPO_PROCESO_NOTIFICACION TPN ON C.ID_TIPO_PROCESO_NOTIFICACION = TPN.ID_TIPO_PROCESO_NOTIFICACION
                  INNER JOIN GENERAL.PERSONAS P ON C.ID_PERSONA = P.ID_PERSONA 
                      INNER JOIN SISTEMA.TIPO_DNI TD ON P.TIPO_DNI = TD.ID_TIPO_DNI 
                  INNER JOIN NEGOCIO.TOMADORES_CONTACTOS TC ON TC.ID_CONTACTO = C.ID_CONTACTO 
                      INNER JOIN NEGOCIO.TOMADORES T ON TC.ID_TOMADOR = T.ID_TOMADOR
                          INNER JOIN NEGOCIO.POLIZAS PZ ON T.ID_TOMADOR = PZ.ID_TOMADOR
                              INNER JOIN NEGOCIO.ASESORES A ON PZ.ID_ASESOR = A.ID_ASESOR
          WHERE 
              A.ID_ASESOR = $3
              AND TC.ID_TOMADOR = $4
          GROUP BY 
              C.ID_CONTACTO,
              T.ID_TOMADOR,
              P.ID_PERSONA,
              PZ.ID_POLIZA,
              P.NOMBRE,
              P.PRIMER_APELLIDO,
              P.SEGUNDO_APELLIDO,
              P.EMAIL,
              P.CELULAR,
              TP.ID_TIPO_CONTACTO,
              TP.DESCRIPCION,
              P.ID_GENERO,
              TD.ID_TIPO_DNI,
              TD.ALIAS,
              P.DNI,
              TPN.ID_TIPO_PROCESO_NOTIFICACION,
              TPN.DESCRIPCION
      `,
        [id_asesor, id_tomador, id_asesor, id_tomador]
    )

    const tipo_proceso_notificacion = await pool.query(`
          SELECT TPN.ID_TIPO_PROCESO_NOTIFICACION, TPN.DESCRIPCION AS PROCESO_NOTIFICACION FROM SISTEMA.TIPO_PROCESO_NOTIFICACION TPN
      `)

    const cabecera = await pool.query(
        `
          SELECT 
              (P.NOMBRE || ' ' || P.PRIMER_APELLIDO) NOMBRE,
              (TD.ALIAS || ' ' || P.DNI) AS DOCUMENTO,
              TD.ID_TIPO_DNI,
              SUM(PZ.VALOR_PRIMA_ACTUAL) AS POLIZA, 
              TO_CHAR(MAX(T.FECHA_ACTUALIZACION), 'DD TMMON YYYY') AS FECHA
          FROM NEGOCIO.TOMADORES T
                  INNER JOIN NEGOCIO.TOMADORES_ASESORES TA ON T.ID_TOMADOR = TA.ID_TOMADOR
                  INNER JOIN GENERAL.PERSONAS P ON T.ID_PERSONA = P.ID_PERSONA 
                      INNER JOIN SISTEMA.TIPO_DNI TD ON P.TIPO_DNI = TD.ID_TIPO_DNI
                  LEFT JOIN NEGOCIO.POLIZAS PZ ON PZ.ID_TOMADOR = T.ID_TOMADOR
          WHERE TA.ID_ASESOR = $1 AND T.ID_TOMADOR = $2
          GROUP BY P.NOMBRE,P.PRIMER_APELLIDO, TD.ALIAS, P.DNI, TD.ID_TIPO_DNI
      `,
        [id_asesor, id_tomador]
    )

    const tipos_dni = await pool.query(`
          SELECT 
              TD.ID_TIPO_DNI,
              (TD.ALIAS || ' - ' || TD.DESCRIPCION) AS DESCRIPCION_DNI
          FROM 
              SISTEMA.TIPO_DNI TD
      `)

    const info_tomador = await pool.query(
        `
          SELECT 
              T.ID_TOMADOR,
              P.DNI AS DNI_TOMADOR,
              TD.ALIAS,
              TD.ID_TIPO_DNI,
              P.CELULAR AS CEL_TOMADOR,
              P.EMAIL AS MAIL_TOMADOR
          FROM 
              "general".PERSONAS P 
                  INNER JOIN NEGOCIO.TOMADORES T ON T.ID_PERSONA = P.ID_PERSONA 
                  INNER JOIN SISTEMA.TIPO_DNI TD ON TD.ID_TIPO_DNI = P.TIPO_DNI 
          WHERE 
              T.ID_TOMADOR = $1
      `,
        [id_tomador]
    )

    const info_config_cartera = await pool.query(
        `
              SELECT
                  ECG.ID_DIAS_PROCESO,
                  DPP.DIAS,
                  ECG.ID_TIPO_NOTIFICACION,
                  TN.DESCRIPCION,
                  CGC.ID_ASESOR 
              FROM 
                  CARTERA.ENVIO_CARTERA_GENERAL AS ECG 
                      INNER JOIN "general".DIAS_POR_PROCESO AS DPP ON DPP.ID_DIAS_PROCESO = ECG.ID_DIAS_PROCESO 
                      INNER JOIN SISTEMA.TIPO_NOTIFICACION AS TN ON TN.ID_TIPO_NOTIFICACION = ECG.ID_TIPO_NOTIFICACION
                      INNER JOIN SISTEMA.CONFIGURACION_GENERAL_CARTERA AS CGC ON CGC.ID_CONF_GRAL_CARTERA = ECG.ID_CONF_GRAL_CARTERA 
              WHERE 
                  CGC.ID_ASESOR = $1
              ORDER BY 
                  DPP.DIAS 
      `,
        [id_asesor]
    )

    const info_config_esp_cartera = await pool.query(
        `
              SELECT
                  P.ID_ASESOR,
                  P.ID_TOMADOR,
                  P.ID_POLIZA,
                  ECE.ID_DIAS_PROCESO,
                  DPP.DIAS,
                  ECE.ID_TIPO_NOTIFICACION,
                  TN.DESCRIPCION
              FROM 
                  CARTERA.ENVIO_CARTERA_ESPECIAL AS ECE
                      INNER JOIN "general".DIAS_POR_PROCESO AS DPP ON DPP.ID_DIAS_PROCESO = ECE.ID_DIAS_PROCESO 
                      INNER JOIN SISTEMA.TIPO_NOTIFICACION AS TN ON TN.ID_TIPO_NOTIFICACION = ECE.ID_TIPO_NOTIFICACION
                      INNER JOIN SISTEMA.CONFIGURACION_ESPECIAL_CARTERA AS CEC ON CEC.ID_CONF_ESP_CARTERA = ECE.ID_CONF_ESP_CARTERA 
                          LEFT JOIN CARTERA.CONFIGURACION_ESPECIAL_POLIZAS CEP ON CEP.ID_CONF_ESP_CARTERA = CEC.ID_CONF_ESP_CARTERA 
                              INNER JOIN NEGOCIO.POLIZAS P ON CEP.ID_POLIZA = P.ID_POLIZA
              WHERE 
                  P.ID_TOMADOR = $1
              ORDER BY 
                  DPP.DIAS 
      `,
        [id_tomador]
    )

    const info_config_renovacion = await pool.query(
        `
          SELECT 
              CGR.ID_CONF_GRAL_RENOVACION,
              CGR.ID_DIAS_PROCESO_RENOVACION,
              DPP.DIAS DIAS_RENOVACION, 
              CGR.ID_DIAS_PROCESO_SOAT,
              DPP2.DIAS DIAS_SOAT
          FROM 
              SISTEMA.CONFIGURACION_GENERAL_RENOVACION CGR
                  INNER JOIN "general".DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = CGR.ID_DIAS_PROCESO_RENOVACION 
                  INNER JOIN "general".DIAS_POR_PROCESO DPP2  ON DPP2.ID_DIAS_PROCESO = CGR.ID_DIAS_PROCESO_SOAT 
          WHERE 
              CGR.ID_ASESOR = $1
          LIMIT 1
      `,
        [id_asesor]
    )

    const info_config_facturacion = await pool.query(
        `
          SELECT 
              CGF.ID_CONF_GRAL_FACTURACION,
              CGF.ID_TIPO_PERIODICIDAD,
              TP.DESCRIPCION DESC_PERIODICIDAD, 
              CGF.ID_TIPO_NOTIFICACION,
              TN.DESCRIPCION DESC_TIPO_NOTIFICACION
          FROM 
              SISTEMA.CONFIGURACION_GENERAL_FACTURACION CGF 
                  INNER JOIN SISTEMA.TIPO_PERIODICIDAD TP  ON TP.ID_TIPO_PERIODICIDAD = CGF.ID_TIPO_PERIODICIDAD 
                  INNER JOIN SISTEMA.TIPO_NOTIFICACION TN ON TN.ID_TIPO_NOTIFICACION = CGF.ID_TIPO_NOTIFICACION 
          WHERE 
              CGF.ID_ASESOR = $1
          LIMIT 1
      `,
        [id_asesor]
    )

    const medios_gestion = await pool.query(`
          SELECT 
              TN.ID_TIPO_NOTIFICACION AS ID_MEDIO_GESTION, 
              TN.DESCRIPCION AS DESCRIPCION_MEDIO_GESTION 
          FROM 
              SISTEMA.TIPO_NOTIFICACION TN
      `)

    const generos = await pool.query(`
          SELECT 
              G.ID_GENERO,
              G.DESCRIPCION AS DESCRIPCION_GENERO
          FROM SISTEMA.GENEROS G 	
      `)

    const tipos_contacto = await pool.query(`
          SELECT
              TP.ID_TIPO_CONTACTO,
              TP.DESCRIPCION AS DESCRIPCION_TIPO_CONTACTO
          FROM SISTEMA.TIPO_CONTACTO TP
      `)

    res.json({
        activos: activos.rows,
        cancelados: cancelados.rows,
        contactos: contactos.rows,
        tipoProcesoNotificacion: tipo_proceso_notificacion.rows,
        cabecera: cabecera.rows,
        tiposDni: tipos_dni.rows,
        infoTomador: info_tomador.rows,
        infoConfigEspecialCartera: mergeConfigCartera(
            info_config_esp_cartera.rows
        ),
        infoConfigCartera: mergeConfigCartera(info_config_cartera.rows),
        mediosGestion: medios_gestion.rows,
        generos: generos.rows,
        tipoContactos: tipos_contacto.rows,
        infoConfigRenovacion: info_config_renovacion.rows,
        infoConfigFacturacion: info_config_facturacion.rows,
    })
}

export const actualizarTomador = async (req, res) => {
    const { id_tomador, id_tipo_dni, dni_tomador, mail_tomador, cel_tomador } =
        req.body

    const persona = await pool.query(
        `
          SELECT
              P.ID_PERSONA 
          FROM GENERAL.PERSONAS P 
                  INNER JOIN NEGOCIO.TOMADORES T ON P.ID_PERSONA = T.ID_PERSONA
          WHERE T.ID_TOMADOR = $1;
      `,
        [id_tomador]
    )

    await pool.query(
        `
          UPDATE 
              GENERAL.PERSONAS
          SET 
              TIPO_DNI = $2, 
              DNI = $3, 
              EMAIL = $4, 
              CELULAR = $5, 
              FECHA_ACTUALIZACION = now()
          WHERE ID_PERSONA = $1
      `,
        [
            persona.rows[0].id_persona,
            id_tipo_dni,
            dni_tomador,
            mail_tomador,
            cel_tomador,
        ]
    )

    res.json({
        msg: 'ActualizaciOn tomador exitosa!!',
    })
}

export const guardarContacto = async (req, res) => {
    const {
        id_tomador,
        nombre,
        primer_apellido,
        segundo_apellido,
        mail_contacto,
        celular,
        id_poliza,
        id_tipo_contacto,
        id_tipo_proceso_notificacion,
        id_tipo_dni,
        dni,
        id_genero,
    } = req.body

    // console.log(req.body)

    const get_secuencia_registro = await pool.query(`
          SELECT nextval('general.personas_id_persona_seq') as id_persona
      `)

    const get_secuencia_contacto = await pool.query(`
          SELECT nextval('negocio.contactos_id_contacto_seq') as id_contacto_seq
      `)

    const id_persona = get_secuencia_registro.rows[0].id_persona
    const id_contacto_seq = get_secuencia_contacto.rows[0].id_contacto_seq

    await pool.query(
        `
      INSERT INTO GENERAL.PERSONAS
      (
          ID_PERSONA, NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, EMAIL, DNI, TIPO_DNI,
          CELULAR, ID_GENERO
          )
          VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
        [
            id_persona,
            nombre,
            primer_apellido,
            segundo_apellido,
            mail_contacto,
            dni,
            id_tipo_dni,
            celular,
            id_genero,
        ]
    )

    await pool.query(
        `
              INSERT INTO NEGOCIO.PERSONAS_TIPO_PERSONA
              (
                  ID_PERSONA, ID_TIPO_PERSONA
              )
              VALUES($1, 6)
          `,
        [id_persona]
    )

    await pool.query(
        `
          INSERT INTO NEGOCIO.CONTACTOS
          (
              ID_CONTACTO, ID_PERSONA, ID_TIPO_PROCESO_NOTIFICACION, ID_TIPO_CONTACTO, 
              POLIZAS_MENSAJES
          )
          VALUES($1, $2, $3, $4, $5 )
      `,
        [
            id_contacto_seq,
            id_persona,
            id_tipo_proceso_notificacion,
            id_tipo_contacto,
            id_poliza,
        ]
    )

    await pool.query(
        `
          INSERT INTO NEGOCIO.TOMADORES_CONTACTOS
          (ID_TOMADOR, ID_CONTACTO)
          VALUES($1, $2)
      `,
        [id_tomador, id_contacto_seq]
    )

    res.json({
        msg: 'Registro contacto exitoso!!',
    })
}

export const actualizarContacto = async (req, res) => {
    const {
        id_contacto,
        id_persona,
        nombre,
        primer_apellido,
        segundo_apellido,
        mail_contacto,
        celular,
        id_poliza,
        id_tipo_contacto,
        id_tipo_proceso_notificacion,
        id_tipo_dni,
        dni,
        id_genero,
    } = req.body

    // console.log(req.body)

    await pool.query(
        `
          UPDATE GENERAL.PERSONAS
          SET NOMBRE= $1, 
              PRIMER_APELLIDO= $2,
              SEGUNDO_APELLIDO= $3,
              EMAIL= $4,
              DNI= $5,
              TIPO_DNI= $6, 
              CELULAR= $7,
              FECHA_ACTUALIZACION= CURRENT_TIMESTAMP,
              ID_GENERO = $8
          WHERE ID_PERSONA= $9
      `,
        [
            nombre,
            primer_apellido,
            segundo_apellido,
            mail_contacto,
            dni,
            id_tipo_dni,
            celular,
            id_genero,
            id_persona,
        ]
    )

    await pool.query(
        `
          UPDATE NEGOCIO.CONTACTOS
          SET 
              ID_TIPO_PROCESO_NOTIFICACION= $1,
              ID_TIPO_CONTACTO= $2,
              FECHA_ACTUALIZACION= CURRENT_TIMESTAMP,
              POLIZAS_MENSAJES = $3
          WHERE ID_CONTACTO= $4
      `,
        [id_tipo_proceso_notificacion, id_tipo_contacto, id_poliza, id_contacto]
    )

    res.json({
        msg: 'ActualizaciOn contacto exitosa!!',
    })
}

export const eliminarContacto = async (req, res) => {
    const { id_contacto, id_persona, id_tomador } = req.body

    await pool.query(
        `
          DELETE FROM NEGOCIO.PERSONAS_TIPO_PERSONA
          WHERE ID_PERSONA= $1 AND ID_TIPO_PERSONA= 6
      `,
        [id_persona]
    )

    await pool.query(
        `
          DELETE FROM NEGOCIO.TOMADORES_CONTACTOS
          WHERE ID_TOMADOR= $1 AND ID_CONTACTO= $2
      `,
        [id_tomador, id_contacto]
    )

    await pool.query(
        `
          DELETE FROM NEGOCIO.CONTACTOS
          WHERE ID_CONTACTO= $1
      `,
        [id_contacto]
    )

    // await pool.query(`
    //     DELETE FROM GENERAL.PERSONAS
    //     WHERE ID_PERSONA= $1;
    // `,[id_persona]);

    res.json({
        msg: 'EliminaciOn del registro contacto exitosa!!',
    })
}

export const cargarInfoEditCartera = async (req, res) => {
    const { id_asesor } = req.body

    // pool.query(`set lc_time='es_ES.UTF-8';`);

    const generales = await pool.query(
        `
          SELECT 
              CGC.DIAS AS DIAS_AVISO,
              CGC.ID_CONF_GRAL_CARTERA,
              CGC.ID_ASESOR,
              CGC.DIAS AS DIAS_CONF,
              CGC.FECHA_ACTUALIZACION,
              ECG.ID_DIAS_PROCESO,
              DPP.DIAS AS DIAS_CARTERA,
              TN.ID_TIPO_NOTIFICACION, 
              TN.DESCRIPCION AS TIPO_NOTIFICACION,
              PEC.ID_PLANTILLA_MAIL_CARTERA,
              PEC.ID_PLANTILLA_TEXTO_CARTERA 
          FROM 
              SISTEMA.CONFIGURACION_GENERAL_CARTERA CGC 
                  INNER JOIN CARTERA.ENVIO_CARTERA_GENERAL ECG ON ECG.ID_CONF_GRAL_CARTERA = CGC.ID_CONF_GRAL_CARTERA 
                      INNER JOIN GENERAL.DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = ECG.ID_DIAS_PROCESO
                      INNER JOIN SISTEMA.TIPO_NOTIFICACION TN ON TN.ID_TIPO_NOTIFICACION = ECG.ID_TIPO_NOTIFICACION 
                      INNER JOIN CARTERA.PLANTILLA_ENVIO_CARTERA PEC ON PEC.ID_ENVIO_CARTERA_GENERAL = ECG.ID_ENVIO_CARTERA_GENERAL 
                  INNER JOIN NEGOCIO.POLIZAS P ON P.ID_ASESOR = CGC.ID_ASESOR 
          WHERE 
              P.ID_ASESOR = $1
          GROUP BY
              CGC.DIAS,
              CGC.ID_CONF_GRAL_CARTERA,
              CGC.ID_ASESOR,
              CGC.DIAS,
              CGC.FECHA_ACTUALIZACION,
              ECG.ID_DIAS_PROCESO,
              DPP.DIAS,
              TN.ID_TIPO_NOTIFICACION, 
              TN.DESCRIPCION,
              PEC.ID_PLANTILLA_MAIL_CARTERA,
              PEC.ID_PLANTILLA_TEXTO_CARTERA 
      `,
        [id_asesor]
    )

    const cartera_especiales = await pool.query(
        `
          SELECT 
              CEC.DIAS AS DIAS_AVISO,
              CEC.ID_CONF_ESP_CARTERA,
              CEC.FECHA_ACTUALIZACION,
              P.ID_POLIZA,
              P.NOMBRE_POLIZA,
              P.ID_TOMADOR,
              (PE.NOMBRE || ' ' || PE.PRIMER_APELLIDO) TOMADOR,
              ECE.ID_DIAS_PROCESO,
              DPP.DIAS AS DIAS_CARTERA,
              TN.ID_TIPO_NOTIFICACION, 
              TN.DESCRIPCION AS TIPO_NOTIFICACION,
              ECE.ID_ENVIO_CARTERA_ESPECIAL,
              PEC.ID_PLANTILLA_MAIL_CARTERA,
              PEC.ID_PLANTILLA_TEXTO_CARTERA 
          FROM 
              SISTEMA.CONFIGURACION_ESPECIAL_CARTERA CEC 
                  INNER JOIN CARTERA.ENVIO_CARTERA_ESPECIAL ECE ON ECE.ID_CONF_ESP_CARTERA = CEC.ID_CONF_ESP_CARTERA 
                      INNER JOIN GENERAL.DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = ECE.ID_DIAS_PROCESO
                      INNER JOIN SISTEMA.TIPO_NOTIFICACION TN ON TN.ID_TIPO_NOTIFICACION = ECE.ID_TIPO_NOTIFICACION 
                      INNER JOIN CARTERA.PLANTILLA_ENVIO_CARTERA PEC ON PEC.ID_ENVIO_CARTERA_ESPECIAL = ECE.ID_ENVIO_CARTERA_ESPECIAL 
                  LEFT JOIN CARTERA.CONFIGURACION_ESPECIAL_POLIZAS CEP ON CEP.ID_CONF_ESP_CARTERA = CEC.ID_CONF_ESP_CARTERA 
                      INNER JOIN NEGOCIO.POLIZAS P ON CEP.ID_POLIZA = P.ID_POLIZA
                      INNER JOIN NEGOCIO.TOMADORES T ON T.ID_TOMADOR = P.ID_TOMADOR 
                          INNER JOIN "general".PERSONAS PE ON PE.ID_PERSONA = T.ID_PERSONA 
          WHERE 
              P.ID_ASESOR = $1
          GROUP BY
              CEC.DIAS,
              CEC.ID_CONF_ESP_CARTERA,
              CEC.FECHA_ACTUALIZACION,
              P.ID_POLIZA,
              P.ID_TOMADOR,
              PE.NOMBRE,
              PE.PRIMER_APELLIDO, 
              P.NOMBRE_POLIZA,
              ECE.ID_DIAS_PROCESO,
              DPP.DIAS,
              TN.ID_TIPO_NOTIFICACION, 
              TN.DESCRIPCION,
              ECE.ID_ENVIO_CARTERA_ESPECIAL,
              PEC.ID_PLANTILLA_MAIL_CARTERA,
              PEC.ID_PLANTILLA_TEXTO_CARTERA 
      `,
        [id_asesor]
    )

    res.json([generales.rows, cartera_especiales.rows])
}

export const cargarInfoConfiguracion = async (req, res) => {
    const { id_asesor } = req.body

    //pool.query(`set lc_time='es_ES.UTF-8';`);

    const contactos = await pool.query(
        `
              SELECT 
                  T.ID_TOMADOR,
                  T.ID_PERSONA,
                  T.ACTIVO,
                  T.ID_TIPO_TOMADOR,
                  (P.NOMBRE || ' ' || P.PRIMER_APELLIDO) AS NOMBRE_TOMADOR,
                  T.FECHA_ACTUALIZACION,
                  P.EMAIL,
                  PTP.ID_TIPO_PERSONA,
                  P.CELULAR 
              FROM 
                  NEGOCIO.TOMADORES T
                      INNER JOIN NEGOCIO.TOMADORES_ASESORES TA ON TA.ID_TOMADOR = T.ID_TOMADOR
                      INNER JOIN "general".PERSONAS P ON P.ID_PERSONA = T.ID_PERSONA 
                          INNER JOIN NEGOCIO.PERSONAS_TIPO_PERSONA AS PTP ON PTP.ID_PERSONA = P.ID_PERSONA 
              WHERE 
                  TA.ID_ASESOR = $1
                  AND PTP.ID_TIPO_PERSONA = 6
      `,
        [id_asesor]
    )

    const generales = await pool.query(
        `
              SELECT 
                  CGC.ID_CONF_GRAL_CARTERA,
                  CGC.ID_ASESOR,
                  P.ID_TOMADOR,
                  CGC.DIAS AS DIAS_CONF,
                  CGC.FECHA_ACTUALIZACION,
                  ECG.ID_DIAS_PROCESO,
                  DPP.DIAS AS DIAS_CARTERA,
                  TN.ID_TIPO_NOTIFICACION, 
                  TN.DESCRIPCION AS TIPO_NOTIFICACION
              FROM 
                  SISTEMA.CONFIGURACION_GENERAL_CARTERA CGC 
                      INNER JOIN CARTERA.ENVIO_CARTERA_GENERAL ECG ON ECG.ID_CONF_GRAL_CARTERA = CGC.ID_CONF_GRAL_CARTERA 
                          INNER JOIN GENERAL.DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = ECG.ID_DIAS_PROCESO
                          INNER JOIN SISTEMA.TIPO_NOTIFICACION TN ON TN.ID_TIPO_NOTIFICACION = ECG.ID_TIPO_NOTIFICACION 
                      INNER JOIN NEGOCIO.POLIZAS P ON P.ID_ASESOR = CGC.ID_ASESOR 
              WHERE 
                  P.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    const cartera_especiales = await pool.query(
        `
          SELECT 
              CEC.ID_CONF_ESP_CARTERA,
              P.ID_POLIZA,
              P.ID_TOMADOR, 
              CEC.FECHA_ACTUALIZACION,
              ECE.ID_DIAS_PROCESO,
              DPP.DIAS AS DIAS_CARTERA,
              TN.ID_TIPO_NOTIFICACION, 
              TN.DESCRIPCION AS TIPO_NOTIFICACION
          FROM 
              SISTEMA.CONFIGURACION_ESPECIAL_CARTERA CEC 
                  INNER JOIN CARTERA.ENVIO_CARTERA_ESPECIAL AS ECE ON ECE.ID_CONF_ESP_CARTERA = CEC.ID_CONF_ESP_CARTERA 
                      INNER JOIN GENERAL.DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = ECE.ID_DIAS_PROCESO 
                      INNER JOIN SISTEMA.TIPO_NOTIFICACION TN ON TN.ID_TIPO_NOTIFICACION = ECE.ID_TIPO_NOTIFICACION 
                  LEFT JOIN CARTERA.CONFIGURACION_ESPECIAL_POLIZAS CEP ON CEP.ID_CONF_ESP_CARTERA = CEC.ID_CONF_ESP_CARTERA 
                      INNER JOIN NEGOCIO.POLIZAS P ON CEP.ID_POLIZA = P.ID_POLIZA
          WHERE 
              P.ID_ASESOR = $1
      `,
        [id_asesor]
    )

    // const facturacion_especiales = await pool.query(`
    //     SELECT
    //         t.id_tomador AS tomador,
    //         *
    //     FROM configuracion_especial_facturacion AS c
    //     INNER JOIN tomadores AS t ON t.id_tomador = c.id_tomador
    //     LEFT JOIN polizas AS p ON p.id_poliza = c.id_poliza
    //     WHERE c.id_asesor = $1
    // `,[id_asesor]);

    // const cabecera = await pool.query(`
    //     SELECT
    //         TO_CHAR(MAX(cg.fecha_actualizacion), 'DD TMMon YYYY') AS fecha
    //     FROM configuraciones_generales AS cg
    //     WHERE cg.id_asesor = $1
    // `,[id_asesor]);

    res.json([contactos.rows, generales.rows, cartera_especiales.rows]) //, facturacion_especiales.rows, cabecera.rows]);
}

export const cargarConfigMensajeMail = async (req, res) => {
    const { id_plantilla } = req.body

    const consulta = await pool.query(
        `
              SELECT
                  ID_PLANTILLA_MAIL_CARTERA ,
                  ASUNTO_INTRO ,
                  ASUNTO_CLIENTE ,
                  ASUNTO_POLIZA ,
                  CONTENIDO_SALUDO ,
                  CONTENIDO_CLIENTE ,
                  CONTENIDO_INFO_PAGO ,
                  CONTENIDO_POLIZA ,
                  CONTENIDO_MES_ADEUDADO ,
                  CONTENIDO_PAGO_DIGITAL ,
                  CONTENIDO_FECHA_PAGO ,
                  CONTENIDO_MEDIO_PAGO ,
                  CONTENIDO_PAGO_BANCARIO ,
                  CONTENIDO_MOSTRAR_MEDIO_PAGO ,
                  CONTENIDO_CIERRE ,
                  CONTENIDO_DESPEDIDA ,
                  FECHA_ACTUALIZACION ,
                  CONTENIDO_COMPLEMENTO ,
                  CONTENIDO_ADICIONAL
              FROM
                  CARTERA.PLANTILLA_MAIL_CARTERA
              WHERE
                  ID_PLANTILLA_MAIL_CARTERA = $1
          `,
        [id_plantilla]
    )

    res.json([consulta.rows])
}

export const cargarConfigMensajeTexto = async (req, res) => {
    const { id_plantilla } = req.body

    const consulta = await pool.query(
        `
              SELECT
                  ID_PLANTILLA_TEXTO_CARTERA,
                  SALUDO,
                  CONTENIDO_CLIENTE,
                  CONTENIDO_ASESOR,
                  CONTENIDO_PAGO,
                  CONTENIDO_POLIZA,
                  FECHA_PAGO,
                  FECHA_ACTUALIZACION,
                  COMPLEMENTO
              FROM
                  CARTERA.PLANTILLA_TEXTO_CARTERA
              WHERE 
                  ID_PLANTILLA_TEXTO_CARTERA = $1
          `,
        [id_plantilla]
    )

    res.json([consulta.rows])
}

export const getAllMensajes = async (req, res) => {
    const { id_plantilla } = req.body

    try {
        const mensaje = await pool.query(
            `
                  SELECT
                      ID_PLANTILLA_TEXTO_CARTERA,
                      SALUDO,
                      CONTENIDO_CLIENTE,
                      CONTENIDO_ASESOR,
                      CONTENIDO_PAGO,
                      CONTENIDO_POLIZA,
                      FECHA_PAGO,
                      FECHA_ACTUALIZACION,
                      COMPLEMENTO
                  FROM
                      CARTERA.PLANTILLA_TEXTO_CARTERA
                  WHERE 
                      ID_PLANTILLA_TEXTO_CARTERA = $1
              `,
            [id_plantilla]
        )

        const correo = await pool.query(
            `
                  SELECT
                      ID_PLANTILLA_MAIL_CARTERA ,
                      ASUNTO_INTRO ,
                      ASUNTO_CLIENTE ,
                      ASUNTO_POLIZA ,
                      CONTENIDO_SALUDO ,
                      CONTENIDO_CLIENTE ,
                      CONTENIDO_INFO_PAGO ,
                      CONTENIDO_POLIZA ,
                      CONTENIDO_MES_ADEUDADO ,
                      CONTENIDO_PAGO_DIGITAL ,
                      CONTENIDO_FECHA_PAGO ,
                      CONTENIDO_MEDIO_PAGO ,
                      CONTENIDO_PAGO_BANCARIO ,
                      CONTENIDO_MOSTRAR_MEDIO_PAGO ,
                      CONTENIDO_CIERRE ,
                      CONTENIDO_DESPEDIDA ,
                      FECHA_ACTUALIZACION ,
                      CONTENIDO_COMPLEMENTO ,
                      CONTENIDO_ADICIONAL
                  FROM
                      CARTERA.PLANTILLA_MAIL_CARTERA
                  WHERE
                      ID_PLANTILLA_MAIL_CARTERA = $1
              `,
            [id_plantilla]
        )

        console.log(mensaje)
        console.log(correo)

        res.json({
            correo: correo.rows[0],
            mensaje: mensaje.rows[0],
        })
    } catch (error) {
        res.status(500)
    }
}

export const guardarConfigMensajeMail = async (req, res) => {
    const {
        asunto_intro,
        asunto_cliente,
        asunto_poliza,
        contenido_saludo,
        contenido_cliente,
        contenido_info_pago,
        contenido_poliza,
        contenido_mes,
        contenido_fecha_pago,
        contenido_medio_pago,
        contenido_pago_digital,
        contenido_bancario,
        contenido_mostrar_medio,
        contenido_cierre,
        contenido_despedida,
        contenido_complemento,
        contenido_adicional,
        id_plantilla,
    } = req.body

    const cartera = await pool.query(
        `
                  UPDATE
                      CARTERA.PLANTILLA_MAIL_CARTERA
                  SET    
                      ASUNTO_INTRO                = $1,
                      ASUNTO_CLIENTE              = $2,
                      ASUNTO_POLIZA               = $3,
                      CONTENIDO_SALUDO            = $4,
                      CONTENIDO_CLIENTE           = $5,
                      CONTENIDO_INFO_PAGO         = $6,
                      CONTENIDO_POLIZA            = $7,
                      CONTENIDO_MES_ADEUDADO      = $8,
                      CONTENIDO_PAGO_DIGITAL      = $9,
                      CONTENIDO_FECHA_PAGO        = $10,
                      CONTENIDO_MEDIO_PAGO        = $11,
                      CONTENIDO_PAGO_BANCARIO     = $12,
                      CONTENIDO_MOSTRAR_MEDIO_PAGO= $13,
                      CONTENIDO_CIERRE            = $14,
                      CONTENIDO_DESPEDIDA         = $15,
                      FECHA_ACTUALIZACION         = CURRENT_TIMESTAMP,
                      CONTENIDO_COMPLEMENTO       = $16,
                      CONTENIDO_ADICIONAL         = $17
                  WHERE
                      ID_PLANTILLA_MAIL_CARTERA = $18
              `,
        [
            asunto_intro,
            asunto_cliente,
            asunto_poliza,
            contenido_saludo,
            contenido_cliente,
            contenido_info_pago,
            contenido_poliza,
            contenido_mes,
            contenido_pago_digital,
            contenido_fecha_pago,
            contenido_medio_pago,
            contenido_bancario,
            contenido_mostrar_medio,
            contenido_cierre,
            contenido_despedida,
            contenido_complemento,
            contenido_adicional,
            id_plantilla,
        ]
    )

    res.json({
        msg: 'Configuración mensaje mail cartera exitosa!!',
    })
}

export const guardarConfigMensajeTexto = async (req, res) => {
    const {
        saludo,
        cliente,
        asesor,
        info_pago,
        poliza,
        fecha_pago,
        complemento,
        id_plantilla,
    } = req.body

    const cartera = await pool.query(
        `
                  UPDATE
                      CARTERA.PLANTILLA_TEXTO_CARTERA
                  SET    
                      SALUDO = $1 ,
                      CONTENIDO_CLIENTE = $2 ,
                      CONTENIDO_ASESOR = $3 ,
                      CONTENIDO_PAGO = $4 ,
                      CONTENIDO_POLIZA = $5 ,
                      FECHA_PAGO = $6 ,
                      FECHA_ACTUALIZACIÓN = CURRENT_TIMESTAMP,
                      COMPLEMENTO = $7
                  WHERE
                      ID_PLANTILLA_TEXTO_CARTERA = $8
              `,
        [
            saludo,
            cliente,
            asesor,
            info_pago,
            poliza,
            fecha_pago,
            complemento,
            id_plantilla,
        ]
    )

    res.json({
        msg: 'Configuración mensaje texto/Whatsapp cartera exitosa!!',
    })
}

export const cargarConfigRenovacionMail = async (req, res) => {
    const { id_asesor, id_tipo } = req.body

    if (id_tipo === 1) {
        const consulta = await pool.query(
            `
              SELECT * FROM mensajes_renovacion_auto WHERE id_asesor = $1
          `,
            [id_asesor]
        )

        res.json([consulta.rows])
    } else if (id_tipo === 2) {
        const consulta = await pool.query(
            `
              SELECT * FROM mensajes_renovacion_salud WHERE id_asesor = $1
          `,
            [id_asesor]
        )

        res.json([consulta.rows])
    } else if (id_tipo === 3) {
        const consulta = await pool.query(
            `
              SELECT * FROM mensajes_renovacion_hogar WHERE id_asesor = $1
          `,
            [id_asesor]
        )

        res.json([consulta.rows])
    } else if (id_tipo === 4) {
        const consulta = await pool.query(
            `
              SELECT * FROM mensajes_renovacion_vida_otro WHERE id_asesor = $1
          `,
            [id_asesor]
        )

        res.json([consulta.rows])
    } else if (id_tipo === 5) {
        const consulta = await pool.query(
            `
              SELECT * FROM mensajes_renovacion_soat WHERE id_asesor = $1
          `,
            [id_asesor]
        )

        res.json([consulta.rows])
    }
}

export const guardarConfigMailAutoRenov = async (req, res) => {
    const {
        id_asesor,
        asunto_intro,
        asunto_poliza,
        asunto_referencia,
        asunto_placa,
        asunto_conector,
        asunto_cliente,
        contenido_inicial,
        contenido_cliente,
        contenido_saludo,
        contenido_agradecimiento,
        contenido_entorno,
        contenido_presentacion,
        contenido_ramo,
        contenido_referencia,
        contenido_complemento,
        contenido_nombre,
        contenido_numero,
        contenido_prima_anterior,
        contenido_prima_actual,
        contenido_inicio_vigencia,
        contenido_fin_vigencia,
        contenido_intro,
        contenido_forma_pago,
        contenido_conector,
        contenido_cuota_actual,
        contenido_comercial1,
        contenido_comercial2,
        contenido_invitacion,
        contenido_beneficio1,
        contenido_beneficio2,
        contenido_beneficio3,
        contenido_beneficio4,
        contenido_eventualidad,
        contenido_medio,
        contenido_digital,
        contenido_bancario,
        contenido_cierre,
        contenido_despedida,
        contenido_tabla,
    } = req.body

    const consulta = await pool.query(
        `
          SELECT id_mensaje FROM mensajes_renovacion_auto WHERE id_asesor = $1
      `,
        [id_asesor]
    )
    var len = consulta.rowCount
    if (len === 0) {
        const mensaje = await pool.query(
            `
              INSERT INTO 
                  mensajes_renovacion_auto 
              VALUES 
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                  $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, 
                  $37, $38, $39, $40, now())
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_placa,
                asunto_conector,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_referencia,
                contenido_complemento,
                contenido_nombre,
                contenido_numero,
                contenido_prima_anterior,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    } else {
        const cartera = await pool.query(
            `
              UPDATE 
                  mensajes_renovacion_auto 
              SET 
                  asunto_intro = $2, 
                  asunto_poliza = $3, 
                  asunto_referencia = $4, 
                  asunto_placa = $5, 
                  asunto_conector = $6,
                  asunto_cliente = $7, 
                  contenido_inicial = $8, 
                  contenido_cliente = $9, 
                  contenido_saludo = $10, 
                  contenido_agradecimiento = $11,
                  contenido_entorno = $12, 
                  contenido_presentacion = $13, 
                  contenido_ramo = $14, 
                  contenido_referencia = $15, 
                  contenido_complemento = $16,
                  contenido_nombre = $17, 
                  contenido_numero = $18, 
                  contenido_prima_anterior = $19, 
                  contenido_prima_actual = $20,
                  contenido_inicio_vigencia = $21, 
                  contenido_fin_vigencia = $22, 
                  contenido_intro = $23, 
                  contenido_forma_pago = $24,
                  contenido_conector = $25, 
                  contenido_cuota_actual = $26, 
                  contenido_comercial1 = $27, 
                  contenido_comercial2 = $28, 
                  contenido_invitacion = $29,
                  contenido_beneficio1 = $30, 
                  contenido_beneficio2 = $31, 
                  contenido_beneficio3 = $32, 
                  contenido_beneficio4 = $33, 
                  contenido_eventualidad = $34,
                  contenido_medio = $35, 
                  contenido_digital = $36, 
                  contenido_bancario = $37, 
                  contenido_cierre = $38, 
                  contenido_despedida = $39, 
                  contenido_tabla = $40, 
                  fecha_actualizacion = now()
              WHERE 
                  id_asesor = $1
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_placa,
                asunto_conector,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_referencia,
                contenido_complemento,
                contenido_nombre,
                contenido_numero,
                contenido_prima_anterior,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    }

    res.json({
        msg: 'ConfiguraciOn mail renovaciOn auto exitosa!!',
    })
}

export const guardarConfigMailSaludRenov = async (req, res) => {
    const {
        id_asesor,
        asunto_intro,
        asunto_poliza,
        asunto_referencia,
        asunto_conector,
        asunto_cliente,
        contenido_inicial,
        contenido_cliente,
        contenido_saludo,
        contenido_agradecimiento,
        contenido_entorno,
        contenido_presentacion,
        contenido_nombre_poliza,
        contenido_n_poliza,
        contenido_conexion,
        contenido_vigencia_ini,
        contenido_vigencia_fin,
        contenido_conector_vigencia,
        contenido_complemento,
        contenido_nombre,
        contenido_numero,
        contenido_prima_anterior,
        contenido_prima_actual,
        contenido_inicio_vigencia,
        contenido_fin_vigencia,
        contenido_intro,
        contenido_forma_pago,
        contenido_conector,
        contenido_cuota_actual,
        contenido_comercial1,
        contenido_comercial2,
        contenido_invitacion,
        contenido_beneficio1,
        contenido_beneficio2,
        contenido_beneficio3,
        contenido_beneficio4,
        contenido_eventualidad,
        contenido_medio,
        contenido_digital,
        contenido_bancario,
        contenido_cierre,
        contenido_despedida,
        contenido_tabla,
    } = req.body

    const consulta = await pool.query(
        `
          SELECT id_mensaje FROM mensajes_renovacion_salud WHERE id_asesor = $1
      `,
        [id_asesor]
    )
    var len = consulta.rowCount
    if (len === 0) {
        const mensaje = await pool.query(
            `
              INSERT INTO 
                  mensajes_renovacion_salud 
              VALUES 
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                  $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, 
                  $37, $38, $39, $40, $41, $42, $43, now())
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_conector,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_nombre_poliza,
                contenido_n_poliza,
                contenido_conexion,
                contenido_vigencia_ini,
                contenido_vigencia_fin,
                contenido_conector_vigencia,
                contenido_complemento,
                contenido_nombre,
                contenido_numero,
                contenido_prima_anterior,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    } else {
        const cartera = await pool.query(
            `
              UPDATE 
                  mensajes_renovacion_salud 
              SET 
                  asunto_intro = $2, 
                  asunto_poliza = $3, 
                  asunto_referencia = $4, 
                  asunto_conector = $5, 
                  asunto_cliente = $6,
                  contenido_inicial = $7, 
                  contenido_cliente = $8, 
                  contenido_saludo = $9, 
                  contenido_agradecimiento = $10, 
                  contenido_entorno = $11,
                  contenido_presentacion = $12, 
                  contenido_nombre_poliza = $13, 
                  contenido_n_poliza = $14, 
                  contenido_conexion = $15,
                  contenido_vigencia_ini = $16, 
                  contenido_vigencia_fin = $17, 
                  contenido_conector_vigencia = $18, 
                  contenido_complemento = $19, 
                  contenido_nombre = $20, 
                  contenido_numero = $21, 
                  contenido_prima_anterior = $22, 
                  contenido_prima_actual = $23, 
                  contenido_inicio_vigencia = $24,
                  contenido_fin_vigencia = $25, 
                  contenido_intro = $26, 
                  contenido_forma_pago = $27, 
                  contenido_conector = $28, 
                  contenido_cuota_actual = $29,
                  contenido_comercial1 = $30, 
                  contenido_comercial2 = $31, 
                  contenido_invitacion = $32, 
                  contenido_beneficio1 = $33,
                  contenido_beneficio2 = $34, 
                  contenido_beneficio3 = $35, 
                  contenido_beneficio4 = $36, 
                  contenido_eventualidad = $37,
                  contenido_medio = $38, 
                  contenido_digital = $39 
                  contenido_bancario = $40, 
                  contenido_cierre = $41, 
                  contenido_despedida = $42,
                  contenido_tabla = $43,
                  fecha_actualizacion = now()
              WHERE 
                  id_asesor = $1
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_conector,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_nombre_poliza,
                contenido_n_poliza,
                contenido_conexion,
                contenido_vigencia_ini,
                contenido_vigencia_fin,
                contenido_conector_vigencia,
                contenido_complemento,
                contenido_nombre,
                contenido_numero,
                contenido_prima_anterior,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    }

    res.json({
        msg: 'ConfiguraciOn mail renovaciOn salud exitosa!!',
    })
}

export const guardarConfigMailHogarRenov = async (req, res) => {
    const {
        id_asesor,
        asunto_intro,
        asunto_poliza,
        asunto_referencia,
        asunto_conector,
        asunto_cliente,
        contenido_inicial,
        contenido_cliente,
        contenido_saludo,
        contenido_agradecimiento,
        contenido_entorno,
        contenido_presentacion,
        contenido_ramo,
        contenido_complemento,
        contenido_nombre,
        contenido_numero,
        contenido_prima_anterior,
        contenido_prima_actual,
        contenido_inicio_vigencia,
        contenido_fin_vigencia,
        contenido_intro,
        contenido_forma_pago,
        contenido_conector,
        contenido_cuota_actual,
        contenido_comercial1,
        contenido_comercial2,
        contenido_invitacion,
        contenido_beneficio1,
        contenido_beneficio2,
        contenido_beneficio3,
        contenido_beneficio4,
        contenido_eventualidad,
        contenido_medio,
        contenido_digital,
        contenido_bancario,
        contenido_cierre,
        contenido_despedida,
        contenido_tabla,
    } = req.body

    const consulta = await pool.query(
        `
          SELECT id_mensaje FROM mensajes_renovacion_hogar WHERE id_asesor = $1
      `,
        [id_asesor]
    )
    var len = consulta.rowCount
    if (len === 0) {
        const mensaje = await pool.query(
            `
              INSERT INTO 
                  mensajes_renovacion_hogar 
              VALUES 
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                  $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, 
                  $37, $38, now())
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_conector,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_complemento,
                contenido_nombre,
                contenido_numero,
                contenido_prima_anterior,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    } else {
        const cartera = await pool.query(
            `
              UPDATE 
                  mensajes_renovacion_hogar 
              SET 
                  asunto_intro = $2, 
                  asunto_poliza = $3, 
                  asunto_referencia = $4, 
                  asunto_conector = $5,
                  asunto_cliente = $6, 
                  contenido_inicial = $7, 
                  contenido_cliente = $8, 
                  contenido_saludo = $9, 
                  contenido_agradecimiento = $10,
                  contenido_entorno = $11, 
                  contenido_presentacion = $12, 
                  contenido_ramo = $13, 
                  contenido_complemento = $14,
                  contenido_nombre = $15, 
                  contenido_numero = $16, 
                  contenido_prima_anterior = $17, 
                  contenido_prima_actual = $18,
                  contenido_inicio_vigencia = $19, 
                  contenido_fin_vigencia = $20, 
                  contenido_intro = $21, 
                  contenido_forma_pago = $22,
                  contenido_conector = $23, 
                  contenido_cuota_actual = $24, 
                  contenido_comercial1 = $25, 
                  contenido_comercial2 = $26, 
                  contenido_invitacion = $27,
                  contenido_beneficio1 = $28, 
                  contenido_beneficio2 = $29, 
                  contenido_beneficio3 = $30, 
                  contenido_beneficio4 = $31, 
                  contenido_eventualidad = $32,
                  contenido_medio = $33, 
                  contenido_digital = $34, 
                  contenido_bancario = $35, 
                  contenido_cierre = $36, 
                  contenido_despedida = $37, 
                  contenido_tabla = $38, 
                  fecha_actualizacion = now()
              WHERE 
                  id_asesor = $1
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_conector,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_complemento,
                contenido_nombre,
                contenido_numero,
                contenido_prima_anterior,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    }

    res.json({
        msg: 'ConfiguraciOn mail renovaciOn hogar exitosa!!',
    })
}

export const guardarConfigMailVidaRenov = async (req, res) => {
    const {
        id_asesor,
        asunto_intro,
        asunto_poliza,
        asunto_referencia,
        asunto_conector,
        asunto_cliente,
        contenido_inicial,
        contenido_cliente,
        contenido_saludo,
        contenido_agradecimiento,
        contenido_entorno,
        contenido_presentacion,
        contenido_ramo,
        contenido_complemento,
        contenido_nombre,
        contenido_numero,
        contenido_prima_anterior,
        contenido_prima_actual,
        contenido_inicio_vigencia,
        contenido_fin_vigencia,
        contenido_intro,
        contenido_forma_pago,
        contenido_conector,
        contenido_cuota_actual,
        contenido_comercial1,
        contenido_comercial2,
        contenido_invitacion,
        contenido_beneficio1,
        contenido_beneficio2,
        contenido_beneficio3,
        contenido_beneficio4,
        contenido_eventualidad,
        contenido_medio,
        contenido_digital,
        contenido_bancario,
        contenido_cierre,
        contenido_despedida,
        contenido_tabla,
    } = req.body

    const consulta = await pool.query(
        `
          SELECT id_mensaje FROM mensajes_renovacion_vida_otro WHERE id_asesor = $1
      `,
        [id_asesor]
    )
    var len = consulta.rowCount
    if (len === 0) {
        const mensaje = await pool.query(
            `
              INSERT INTO 
                  mensajes_renovacion_vida_otro 
              VALUES 
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                  $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, 
                  $37, $38, now())
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_conector,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_complemento,
                contenido_nombre,
                contenido_numero,
                contenido_prima_anterior,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    } else {
        const cartera = await pool.query(
            `
              UPDATE 
                  mensajes_renovacion_vida_otro 
              SET 
                  asunto_intro = $2, 
                  asunto_poliza = $3, 
                  asunto_referencia = $4, 
                  asunto_conector = $5,
                  asunto_cliente = $6, 
                  contenido_inicial = $7, 
                  contenido_cliente = $8, 
                  contenido_saludo = $9, 
                  contenido_agradecimiento = $10,
                  contenido_entorno = $11, 
                  contenido_presentacion = $12, 
                  contenido_ramo = $13, 
                  contenido_complemento = $14,
                  contenido_nombre = $15, 
                  contenido_numero = $16, 
                  contenido_prima_anterior = $17, 
                  contenido_prima_actual = $18,
                  contenido_inicio_vigencia = $19, 
                  contenido_fin_vigencia = $20, 
                  contenido_intro = $21, 
                  contenido_forma_pago = $22,
                  contenido_conector = $23, 
                  contenido_cuota_actual = $24, 
                  contenido_comercial1 = $25, 
                  contenido_comercial2 = $26, 
                  contenido_invitacion = $27,
                  contenido_beneficio1 = $28, 
                  contenido_beneficio2 = $29, 
                  contenido_beneficio3 = $30, 
                  contenido_beneficio4 = $31, 
                  contenido_eventualidad = $32,
                  contenido_medio = $33, 
                  contenido_digital = $34, 
                  contenido_bancario = $35, 
                  contenido_cierre = $36, 
                  contenido_despedida = $37, 
                  contenido_tabla = $38, 
                  fecha_actualizacion = now()
              WHERE 
                  id_asesor = $1
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_conector,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_complemento,
                contenido_nombre,
                contenido_numero,
                contenido_prima_anterior,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    }

    res.json({
        msg: 'ConfiguraciOn mail renovaciOn vida / otros exitosa!!',
    })
}

export const guardarConfigMailSoatRenov = async (req, res) => {
    const {
        id_asesor,
        asunto_intro,
        asunto_poliza,
        asunto_referencia,
        asunto_cliente,
        contenido_inicial,
        contenido_cliente,
        contenido_saludo,
        contenido_agradecimiento,
        contenido_entorno,
        contenido_presentacion,
        contenido_ramo,
        contenido_intro,
        contenido_forma_pago,
        contenido_conector,
        contenido_cuota_actual,
        contenido_fin_vigencia,
        contenido_complemento,
        contenido_recordatorio,
        contenido_pasos,
        contenido_paso1,
        contenido_paso2,
        contenido_paso3,
        contenido_paso4,
        contenido_paso5,
        contenido_invitacion,
        contenido_eventualidad,
        contenido_medio,
        contenido_digital,
        contenido_bancario,
        contenido_cierre,
        contenido_despedida,
        contenido_tabla,
    } = req.body

    const consulta = await pool.query(
        `
          SELECT id_mensaje FROM mensajes_renovacion_soat WHERE id_asesor = $1
      `,
        [id_asesor]
    )
    var len = consulta.rowCount
    if (len === 0) {
        const mensaje = await pool.query(
            `
              INSERT INTO 
                  mensajes_renovacion_soat 
              VALUES 
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                  $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, now())
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_fin_vigencia,
                contenido_complemento,
                contenido_recordatorio,
                contenido_pasos,
                contenido_paso1,
                contenido_paso2,
                contenido_paso3,
                contenido_paso4,
                contenido_paso5,
                contenido_invitacion,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    } else {
        const cartera = await pool.query(
            `
              UPDATE 
                  mensajes_renovacion_soat 
              SET 
                  asunto_intro = $2, 
                  asunto_poliza = $3, 
                  asunto_referencia = $4, 
                  asunto_cliente = $5, 
                  contenido_inicial = $6,
                  contenido_cliente = $7, 
                  contenido_saludo = $8, 
                  contenido_agradecimiento = $9, 
                  contenido_entorno = $10, 
                  contenido_presentacion = $11,
                  contenido_ramo = $12, 
                  contenido_intro = $13, 
                  contenido_forma_pago = $14, 
                  contenido_conector = $15, 
                  contenido_cuota_actual = $16,
                  contenido_fin_vigencia = $17, 
                  contenido_complemento = $18, 
                  contenido_recordatorio = $19, 
                  contenido_pasos = $20, 
                  contenido_paso1 = $21,
                  contenido_paso2 = $22, 
                  contenido_paso3 = $23, 
                  contenido_paso4 = $24, 
                  contenido_paso5 = $25, 
                  contenido_invitacion = $26,
                  contenido_eventualidad = $27, 
                  contenido_medio = $28, 
                  contenido_digital = $29, 
                  contenido_bancario = $30, 
                  contenido_cierre = $31,
                  contenido_despedida = $32, 
                  contenido_tabla = $33, 
                  fecha_actualizacion = now()
              WHERE 
                  id_asesor = $1
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_fin_vigencia,
                contenido_complemento,
                contenido_recordatorio,
                contenido_pasos,
                contenido_paso1,
                contenido_paso2,
                contenido_paso3,
                contenido_paso4,
                contenido_paso5,
                contenido_invitacion,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    }

    res.json({
        msg: 'ConfiguraciOn mail renovaciOn soat exitosa!!',
    })
}

export const cargarConfigSolicitudMail = async (req, res) => {
    const { id_asesor, id_tipo } = req.body

    if (id_tipo === 1) {
        const consulta = await pool.query(
            `
              SELECT * FROM mensajes_solicitud_auto WHERE id_asesor = $1
          `,
            [id_asesor]
        )

        res.json([consulta.rows])
    } else if (id_tipo === 2) {
        const consulta = await pool.query(
            `
              SELECT * FROM mensajes_solicitud_salud WHERE id_asesor = $1
          `,
            [id_asesor]
        )

        res.json([consulta.rows])
    } else if (id_tipo === 3) {
        const consulta = await pool.query(
            `
              SELECT * FROM mensajes_solicitud_hogar WHERE id_asesor = $1
          `,
            [id_asesor]
        )

        res.json([consulta.rows])
    } else if (id_tipo === 4) {
        const consulta = await pool.query(
            `
              SELECT * FROM mensajes_solicitud_vida_otro WHERE id_asesor = $1
          `,
            [id_asesor]
        )

        res.json([consulta.rows])
    } else if (id_tipo === 5) {
        const consulta = await pool.query(
            `
              SELECT * FROM mensajes_solicitud_soat WHERE id_asesor = $1
          `,
            [id_asesor]
        )

        res.json([consulta.rows])
    }
}

export const guardarConfigMailAutoSolic = async (req, res) => {
    const {
        id_asesor,
        asunto_intro,
        asunto_poliza,
        asunto_referencia,
        asunto_placa,
        asunto_conector,
        asunto_cliente,
        contenido_inicial,
        contenido_cliente,
        contenido_saludo,
        contenido_agradecimiento,
        contenido_entorno,
        contenido_presentacion,
        contenido_ramo,
        contenido_nombre,
        contenido_numero,
        contenido_prima_actual,
        contenido_inicio_vigencia,
        contenido_fin_vigencia,
        contenido_intro,
        contenido_forma_pago,
        contenido_conector,
        contenido_cuota_actual,
        contenido_comercial1,
        contenido_comercial2,
        contenido_invitacion,
        contenido_beneficio1,
        contenido_beneficio2,
        contenido_beneficio3,
        contenido_beneficio4,
        contenido_eventualidad,
        contenido_medio,
        contenido_digital,
        contenido_bancario,
        contenido_cierre,
        contenido_despedida,
        contenido_tabla,
    } = req.body

    const consulta = await pool.query(
        `
          SELECT id_mensaje FROM mensajes_solicitud_auto WHERE id_asesor = $1
      `,
        [id_asesor]
    )
    var len = consulta.rowCount
    if (len === 0) {
        const mensaje = await pool.query(
            `
              INSERT INTO 
                  mensajes_solicitud_auto 
              VALUES 
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                  $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, now())
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_placa,
                asunto_conector,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_nombre,
                contenido_numero,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    } else {
        const cartera = await pool.query(
            `
              UPDATE 
                  mensajes_solicitud_auto 
              SET 
                  asunto_intro = $2, 
                  asunto_poliza = $3, 
                  asunto_referencia = $4, 
                  asunto_placa = $5, 
                  asunto_conector = $6,
                  asunto_cliente = $7, 
                  contenido_inicial = $8, 
                  contenido_cliente = $9, 
                  contenido_saludo = $10, 
                  contenido_agradecimiento = $11,
                  contenido_entorno = $12, 
                  contenido_presentacion = $13, 
                  contenido_ramo = $14, 
                  contenido_nombre = $15, 
                  contenido_numero = $16,
                  contenido_prima_actual = $17, 
                  contenido_inicio_vigencia = $18, 
                  contenido_fin_vigencia = $19, 
                  contenido_intro = $20,
                  contenido_forma_pago = $21, 
                  contenido_conector = $22, 
                  contenido_cuota_actual = $23, 
                  contenido_comercial1 = $24, 
                  contenido_comercial2 = $25,
                  contenido_invitacion = $26, 
                  contenido_beneficio1 = $27, 
                  contenido_beneficio2 = $28, 
                  contenido_beneficio3 = $29, 
                  contenido_beneficio4 = $30,
                  contenido_eventualidad = $31, 
                  contenido_medio = $32, 
                  contenido_digital = $33, 
                  contenido_bancario = $34, 
                  contenido_cierre = $35,
                  contenido_despedida = $36, 
                  contenido_tabla = $37,  
                  fecha_actualizacion = now()
              WHERE 
                  id_asesor = $1
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_placa,
                asunto_conector,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_nombre,
                contenido_numero,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    }

    res.json({
        msg: 'ConfiguraciOn mail solicitud auto exitosa!!',
    })
}

export const guardarConfigMailHogarSolic = async (req, res) => {
    const {
        id_asesor,
        asunto_intro,
        asunto_poliza,
        asunto_referencia,
        asunto_cliente,
        contenido_inicial,
        contenido_cliente,
        contenido_saludo,
        contenido_agradecimiento,
        contenido_entorno,
        contenido_presentacion,
        contenido_ramo,
        contenido_nombre,
        contenido_numero,
        contenido_prima_actual,
        contenido_inicio_vigencia,
        contenido_fin_vigencia,
        contenido_intro,
        contenido_forma_pago,
        contenido_conector,
        contenido_cuota_actual,
        contenido_comercial1,
        contenido_comercial2,
        contenido_invitacion,
        contenido_beneficio1,
        contenido_beneficio2,
        contenido_beneficio3,
        contenido_beneficio4,
        contenido_eventualidad,
        contenido_medio,
        contenido_digital,
        contenido_bancario,
        contenido_cierre,
        contenido_despedida,
        contenido_tabla,
    } = req.body

    const consulta = await pool.query(
        `
          SELECT id_mensaje FROM mensajes_solicitud_hogar WHERE id_asesor = $1
      `,
        [id_asesor]
    )
    var len = consulta.rowCount
    if (len === 0) {
        const mensaje = await pool.query(
            `
              INSERT INTO 
                  mensajes_solicitud_hogar 
              VALUES 
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                  $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, now())
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_nombre,
                contenido_numero,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    } else {
        const cartera = await pool.query(
            `
              UPDATE 
                  mensajes_solicitud_hogar 
              SET 
                  asunto_intro = $2, 
                  asunto_poliza = $3, 
                  asunto_referencia = $4, 
                  asunto_cliente = $5, 
                  contenido_inicial = $6, 
                  contenido_cliente = $7, 
                  contenido_saludo = $8, 
                  contenido_agradecimiento = $9,
                  contenido_entorno = $10, 
                  contenido_presentacion = $11, 
                  contenido_ramo = $12, 
                  contenido_nombre = $13, 
                  contenido_numero = $14,
                  contenido_prima_actual = $15, 
                  contenido_inicio_vigencia = $16, 
                  contenido_fin_vigencia = $17, 
                  contenido_intro = $18,
                  contenido_forma_pago = $19, 
                  contenido_conector = $20, 
                  contenido_cuota_actual = $21, 
                  contenido_comercial1 = $22, 
                  contenido_comercial2 = $23,
                  contenido_invitacion = $24, 
                  contenido_beneficio1 = $25, 
                  contenido_beneficio2 = $26, 
                  contenido_beneficio3 = $27, 
                  contenido_beneficio4 = $28,
                  contenido_eventualidad = $29, 
                  contenido_medio = $30, 
                  contenido_digital = $31, 
                  contenido_bancario = $32, 
                  contenido_cierre = $33,
                  contenido_despedida = $34, 
                  contenido_tabla = $35, 
                  fecha_actualizacion = now()
              WHERE 
                  id_asesor = $1
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_nombre,
                contenido_numero,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    }

    res.json({
        msg: 'ConfiguraciOn mail solicitud hogar exitosa!!',
    })
}

export const guardarConfigMailSaludSolic = async (req, res) => {
    const {
        id_asesor,
        asunto_intro,
        asunto_poliza,
        asunto_referencia,
        asunto_cliente,
        contenido_inicial,
        contenido_cliente,
        contenido_saludo,
        contenido_agradecimiento,
        contenido_entorno,
        contenido_presentacion,
        contenido_ramo,
        contenido_nombre,
        contenido_numero,
        contenido_prima_actual,
        contenido_inicio_vigencia,
        contenido_fin_vigencia,
        contenido_intro,
        contenido_forma_pago,
        contenido_conector,
        contenido_cuota_actual,
        contenido_comercial1,
        contenido_comercial2,
        contenido_invitacion,
        contenido_beneficio1,
        contenido_beneficio2,
        contenido_beneficio3,
        contenido_beneficio4,
        contenido_eventualidad,
        contenido_medio,
        contenido_digital,
        contenido_bancario,
        contenido_cierre,
        contenido_despedida,
        contenido_tabla,
    } = req.body

    const consulta = await pool.query(
        `
          SELECT id_mensaje FROM mensajes_solicitud_salud WHERE id_asesor = $1
      `,
        [id_asesor]
    )
    var len = consulta.rowCount
    if (len === 0) {
        const mensaje = await pool.query(
            `
              INSERT INTO 
                  mensajes_solicitud_salud 
              VALUES 
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                  $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, now())
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_nombre,
                contenido_numero,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    } else {
        const cartera = await pool.query(
            `
              UPDATE 
                  mensajes_solicitud_salud 
              SET 
                  asunto_intro = $2, 
                  asunto_poliza = $3, 
                  asunto_referencia = $4, 
                  asunto_cliente = $5, 
                  contenido_inicial = $6, 
                  contenido_cliente = $7, 
                  contenido_saludo = $8, 
                  contenido_agradecimiento = $9,
                  contenido_entorno = $10, 
                  contenido_presentacion = $11, 
                  contenido_ramo = $12, 
                  contenido_nombre = $13, 
                  contenido_numero = $14,
                  contenido_prima_actual = $15, 
                  contenido_inicio_vigencia = $16, 
                  contenido_fin_vigencia = $17, 
                  contenido_intro = $18,
                  contenido_forma_pago = $19, 
                  contenido_conector = $20, 
                  contenido_cuota_actual = $21, 
                  contenido_comercial1 = $22, 
                  contenido_comercial2 = $23,
                  contenido_invitacion = $24, 
                  contenido_beneficio1 = $25, 
                  contenido_beneficio2 = $26, 
                  contenido_beneficio3 = $27, 
                  contenido_beneficio4 = $28,
                  contenido_eventualidad = $29, 
                  contenido_medio = $30, 
                  contenido_digital = $31, 
                  contenido_bancario = $32, 
                  contenido_cierre = $33,
                  contenido_despedida = $34, 
                  contenido_tabla = $35, 
                  fecha_actualizacion = now()
              WHERE 
                  id_asesor = $1
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_nombre,
                contenido_numero,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    }

    res.json({
        msg: 'ConfiguraciOn mail solicitud salud exitosa!!',
    })
}

export const guardarConfigMailVidaSolic = async (req, res) => {
    const {
        id_asesor,
        asunto_intro,
        asunto_poliza,
        asunto_referencia,
        asunto_cliente,
        contenido_inicial,
        contenido_cliente,
        contenido_saludo,
        contenido_agradecimiento,
        contenido_entorno,
        contenido_presentacion,
        contenido_ramo,
        contenido_nombre,
        contenido_numero,
        contenido_prima_actual,
        contenido_inicio_vigencia,
        contenido_fin_vigencia,
        contenido_intro,
        contenido_forma_pago,
        contenido_conector,
        contenido_cuota_actual,
        contenido_comercial1,
        contenido_comercial2,
        contenido_invitacion,
        contenido_beneficio1,
        contenido_beneficio2,
        contenido_beneficio3,
        contenido_beneficio4,
        contenido_eventualidad,
        contenido_medio,
        contenido_digital,
        contenido_bancario,
        contenido_cierre,
        contenido_despedida,
        contenido_tabla,
    } = req.body

    const consulta = await pool.query(
        `
          SELECT id_mensaje FROM mensajes_solicitud_vida_otro WHERE id_asesor = $1
      `,
        [id_asesor]
    )
    var len = consulta.rowCount
    if (len === 0) {
        const mensaje = await pool.query(
            `
              INSERT INTO 
                  mensajes_solicitud_vida_otro 
              VALUES 
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                  $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, now())
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_nombre,
                contenido_numero,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    } else {
        const cartera = await pool.query(
            `
              UPDATE 
                  mensajes_solicitud_vida_otro 
              SET 
                  asunto_intro = $2, 
                  asunto_poliza = $3, 
                  asunto_referencia = $4, 
                  asunto_cliente = $5, 
                  contenido_inicial = $6, 
                  contenido_cliente = $7, 
                  contenido_saludo = $8, 
                  contenido_agradecimiento = $9,
                  contenido_entorno = $10, 
                  contenido_presentacion = $11, 
                  contenido_ramo = $12, 
                  contenido_nombre = $13, 
                  contenido_numero = $14,
                  contenido_prima_actual = $15, 
                  contenido_inicio_vigencia = $16, 
                  contenido_fin_vigencia = $17, 
                  contenido_intro = $18,
                  contenido_forma_pago = $19, 
                  contenido_conector = $20, 
                  contenido_cuota_actual = $21, 
                  contenido_comercial1 = $22, 
                  contenido_comercial2 = $23,
                  contenido_invitacion = $24, 
                  contenido_beneficio1 = $25, 
                  contenido_beneficio2 = $26, 
                  contenido_beneficio3 = $27, 
                  contenido_beneficio4 = $28,
                  contenido_eventualidad = $29, 
                  contenido_medio = $30, 
                  contenido_digital = $31, 
                  contenido_bancario = $32, 
                  contenido_cierre = $33,
                  contenido_despedida = $34,
                  contenido_tabla = $35,  
                  fecha_actualizacion = now()
              WHERE 
                  id_asesor = $1
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_nombre,
                contenido_numero,
                contenido_prima_actual,
                contenido_inicio_vigencia,
                contenido_fin_vigencia,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_comercial1,
                contenido_comercial2,
                contenido_invitacion,
                contenido_beneficio1,
                contenido_beneficio2,
                contenido_beneficio3,
                contenido_beneficio4,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    }

    res.json({
        msg: 'ConfiguraciOn mail solicitud vida / otro exitosa!!',
    })
}

export const guardarConfigMailSoatSolic = async (req, res) => {
    const {
        id_asesor,
        asunto_intro,
        asunto_poliza,
        asunto_referencia,
        asunto_cliente,
        contenido_inicial,
        contenido_cliente,
        contenido_saludo,
        contenido_agradecimiento,
        contenido_entorno,
        contenido_presentacion,
        contenido_ramo,
        contenido_intro,
        contenido_forma_pago,
        contenido_conector,
        contenido_cuota_actual,
        contenido_fin_vigencia,
        contenido_complemento,
        contenido_recordatorio,
        contenido_pasos,
        contenido_paso1,
        contenido_paso2,
        contenido_paso3,
        contenido_paso4,
        contenido_paso5,
        contenido_invitacion,
        contenido_eventualidad,
        contenido_medio,
        contenido_digital,
        contenido_bancario,
        contenido_cierre,
        contenido_despedida,
        contenido_tabla,
    } = req.body

    const consulta = await pool.query(
        `
          SELECT id_mensaje FROM mensajes_solicitud_soat WHERE id_asesor = $1
      `,
        [id_asesor]
    )
    var len = consulta.rowCount
    if (len === 0) {
        const mensaje = await pool.query(
            `
              INSERT INTO 
                  mensajes_solicitud_soat 
              VALUES 
                  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
                  $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, now())
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_fin_vigencia,
                contenido_complemento,
                contenido_recordatorio,
                contenido_pasos,
                contenido_paso1,
                contenido_paso2,
                contenido_paso3,
                contenido_paso4,
                contenido_paso5,
                contenido_invitacion,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    } else {
        const cartera = await pool.query(
            `
              UPDATE 
                  mensajes_solicitud_soat 
              SET 
                  asunto_intro = $2, 
                  asunto_poliza = $3, 
                  asunto_referencia = $4, 
                  asunto_cliente = $5, 
                  contenido_inicial = $6,
                  contenido_cliente = $7, 
                  contenido_saludo = $8, 
                  contenido_agradecimiento = $9, 
                  contenido_entorno = $10, 
                  contenido_presentacion = $11,
                  contenido_ramo = $12, 
                  contenido_intro = $13, 
                  contenido_forma_pago = $14, 
                  contenido_conector = $15, 
                  contenido_cuota_actual = $16,
                  contenido_fin_vigencia = $17, 
                  contenido_complemento = $18, 
                  contenido_recordatorio = $19, 
                  contenido_pasos = $20, 
                  contenido_paso1 = $21,
                  contenido_paso2 = $22, 
                  contenido_paso3 = $23, 
                  contenido_paso4 = $24, 
                  contenido_paso5 = $25, 
                  contenido_invitacion = $26,
                  contenido_eventualidad = $27, 
                  contenido_medio = $28, 
                  contenido_digital = $29, 
                  contenido_bancario = $30, 
                  contenido_cierre = $31,
                  contenido_despedida = $32, 
                  contenido_tabla = $33, 
                  fecha_actualizacion = now()
              WHERE 
                  id_asesor = $1
          `,
            [
                id_asesor,
                asunto_intro,
                asunto_poliza,
                asunto_referencia,
                asunto_cliente,
                contenido_inicial,
                contenido_cliente,
                contenido_saludo,
                contenido_agradecimiento,
                contenido_entorno,
                contenido_presentacion,
                contenido_ramo,
                contenido_intro,
                contenido_forma_pago,
                contenido_conector,
                contenido_cuota_actual,
                contenido_fin_vigencia,
                contenido_complemento,
                contenido_recordatorio,
                contenido_pasos,
                contenido_paso1,
                contenido_paso2,
                contenido_paso3,
                contenido_paso4,
                contenido_paso5,
                contenido_invitacion,
                contenido_eventualidad,
                contenido_medio,
                contenido_digital,
                contenido_bancario,
                contenido_cierre,
                contenido_despedida,
                contenido_tabla,
            ]
        )
    }

    res.json({
        msg: 'ConfiguraciOn mail solicitud soat exitosa!!',
    })
}

export const guardarConfigCarteraGral = async (req, res) => {
    const { id_asesor, dia_cartera, dias_cartera, id_tipo_notificacion } =
        req.body

    const configGralCartera = await pool.query(
        `
          INSERT INTO SISTEMA.CONFIGURACION_GENERAL_CARTERA (ID_ASESOR, DIAS) VALUES($1, $2)
      `,
        id_asesor,
        dia_cartera
    )

    const idConfGralCartera = await pool.query(`
          SELECT MAX(CGC.ID_CONF_GRAL_CARTERA) FROM SISTEMA. CONFIGURACION_GENERAL_CARTERA CGC
      `)

    const envioCarteraGral = await pool.query(
        `
          INSERT INTO CARTERA.ENVIO_CARTERA_GENERAL (ID_DIAS_PROCESO, ID_TIPO_NOTIFICACION, ID_CONF_GRAL_CARTERA, ID_CICLO_NOTIFICACION) VALUES($1, $2, $3, $4)
      `,
        dias_cartera,
        id_tipo_notificacion,
        idConfGralCartera,
        1
    )

    res.json({
        msg: 'Registro configuración cartera general exitoso!!',
    })
}

export const actualizarConfigCarteraGral = async (req, res) => {
    const {
        id_configuracion,
        id_asesor,
        id_cartera_dias,
        dia_cartera,
        id_tipo_notificacion,
    } = req.body

    const configGralCartera = await pool.query(
        `
          UPDATE 
              SISTEMA.CONFIGURACION_GENERAL_CARTERA CGC
          SET
              CGC.DIAS = $1,
              CGC.FECHA_ACTUALIZACION = CURRENT_TIMESTAMP 
          WHERE 
              CGC.ID_CONF_GRAL_CARTERA = $2
              AND CGC.ID_ASESOR = $3
      `,
        dia_cartera,
        id_configuracion,
        id_asesor
    )

    const envioCarteraGral = await pool.query(
        `
          UPDATE 
              CARTERA.ENVIO_CARTERA_GENERAL ECG 
          SET 
              ECG.ID_DIAS_PROCESO = $1,
              ECG.ID_TIPO_NOTIFICACION = $2,
              ECG.FECHA_ACTUALIZACION = CURRENT_TIMESTAMP
          WHERE 
              ECG.ID_CONF_GRAL_CARTERA =$3
      `,
        id_cartera_dias,
        id_tipo_notificacion,
        id_configuracion
    )

    res.json({
        msg: 'Actualización configuración cartera general exitoso!!',
    })
}

export const eliminarConfigCarteraGral = async (req, res) => {
    const { id_configuracion, dias } = req.body

    const plantillaMail = await pool.query(
        `
          DELETE
          FROM
              CARTERA.PLANTILLA_MAIL_CARTERA PMC
          WHERE
              PMC.ID_PLANTILLA_MAIL_CARTERA = 
              (
                  SELECT
                      PEC.ID_PLANTILLA_MAIL_CARTERA
                  FROM
                      CARTERA.PLANTILLA_ENVIO_CARTERA PEC
                          INNER JOIN CARTERA.ENVIO_CARTERA_GENERAL ECG ON ECG.ID_ENVIO_CARTERA_GENERAL = PEC.ID_ENVIO_CARTERA_GENERAL 
                              INNER JOIN SISTEMA.CONFIGURACION_GENERAL_CARTERA CGC ON CGC.ID_CONF_GRAL_CARTERA = ECG.ID_CONF_GRAL_CARTERA 
                              INNER JOIN "general".DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = ECG.ID_DIAS_PROCESO
                  WHERE
                      CGC.ID_CONF_GRAL_CARTERA = $1
                      AND DPP.DIAS = $2
              )
      `,
        [id_configuracion, dias]
    )

    const plantillaTexto = await pool.query(
        `
          DELETE
          FROM
              CARTERA.PLANTILLA_TEXTO_CARTERA PTC
          WHERE
              PTC.ID_PLANTILLA_TEXTO_CARTERA = 
              (
                  SELECT
                      PEC.ID_PLANTILLA_TEXTO_CARTERA
                  FROM
                      CARTERA.PLANTILLA_ENVIO_CARTERA PEC
                          INNER JOIN CARTERA.ENVIO_CARTERA_GENERAL ECG ON ECG.ID_ENVIO_CARTERA_GENERAL = PEC.ID_ENVIO_CARTERA_GENERAL 
                              INNER JOIN SISTEMA.CONFIGURACION_GENERAL_CARTERA CGC ON CGC.ID_CONF_GRAL_CARTERA = ECG.ID_CONF_GRAL_CARTERA 
                              INNER JOIN "general".DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = ECG.ID_DIAS_PROCESO
                  WHERE
                      CGC.ID_CONF_GRAL_CARTERA = $1
                      AND DPP.DIAS = $2
              )
      `,
        [id_configuracion, dias]
    )

    const plantillaEnvioCartera = await pool.query(
        `
          DELETE
          FROM
              CARTERA.PLANTILLA_ENVIO_CARTERA PEC
          WHERE
              PEC.ID_PLANTILLA_ENVIO_CARTERA = 
              (
                  SELECT
                      PEC.ID_PLANTILLA_ENVIO_CARTERA
                  FROM
                      CARTERA.PLANTILLA_ENVIO_CARTERA PEC
                          INNER JOIN CARTERA.ENVIO_CARTERA_GENERAL ECG ON ECG.ID_ENVIO_CARTERA_GENERAL = PEC.ID_ENVIO_CARTERA_GENERAL 
                              INNER JOIN SISTEMA.CONFIGURACION_GENERAL_CARTERA CGC ON CGC.ID_CONF_GRAL_CARTERA = ECG.ID_CONF_GRAL_CARTERA 
                              INNER JOIN "general".DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = ECG.ID_DIAS_PROCESO
                  WHERE
                      CGC.ID_CONF_GRAL_CARTERA = $1
                      AND DPP.DIAS = $2
              )
      `,
        [id_configuracion, dias]
    )

    const envioCartera = await pool.query(
        `
          DELETE FROM CARTERA.ENVIO_CARTERA_GENERAL ECG WHERE ECG.ID_CONF_GRAL_CARTERA = $1
      `,
        [id_configuracion]
    )

    const configCartera = await pool.query(
        `
          DELETE FROM SISTEMA.CONFIGURACION_GENERAL_CARTERA CGC WHERE CGC.ID_CONF_GRAL_CARTERA = $1
      `,
        [id_configuracion]
    )

    res.json({
        msg: 'Eliminación de configuración de cartera general exitosa!!',
    })
}

export const guardarPlantillaMail = async (req, res) => {
    const {
        asuntoIntro,
        asuntoCliente,
        asuntoPoliza,
        contSaludo,
        contCliente,
        contInfoPago,
        contPoliza,
        contMesAdeudado,
        contPagoDigital,
        contFechaPago,
        contMedioPago,
        contPagoBancario,
        contMostrarMedioPago,
        contCierre,
        contDespedida,
        contComplemento,
        contAdicional,
    } = req.body

    const plantillaMail = await pool.query(
        `
                  INSERT INTO
                      CARTERA.PLANTILLA_MAIL_CARTERA 
                      (
                          ASUNTO_INTRO,
                          ASUNTO_CLIENTE,
                          ASUNTO_POLIZA,
                          CONTENIDO_SALUDO,
                          CONTENIDO_CLIENTE,
                          CONTENIDO_INFO_PAGO,
                          CONTENIDO_POLIZA,
                          CONTENIDO_MES_ADEUDADO,
                          CONTENIDO_PAGO_DIGITAL,
                          CONTENIDO_FECHA_PAGO,
                          CONTENIDO_MEDIO_PAGO,
                          CONTENIDO_PAGO_BANCARIO,
                          CONTENIDO_MOSTRAR_MEDIO_PAGO,
                          CONTENIDO_CIERRE,
                          CONTENIDO_DESPEDIDA,
                          CONTENIDO_COMPLEMENTO,
                          CONTENIDO_ADICIONAL
                      )
                  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
              `,
        asuntoIntro,
        asuntoCliente,
        asuntoPoliza,
        contSaludo,
        contCliente,
        contInfoPago,
        contPoliza,
        contMesAdeudado,
        contPagoDigital,
        contFechaPago,
        contMedioPago,
        contPagoBancario,
        contMostrarMedioPago,
        contCierre,
        contDespedida,
        contComplemento,
        contAdicional
    )

    res.json({
        msg: 'Registro plantilla mail exitoso!!',
    })
}

export const guardarPlantillaTexto = async (req, res) => {
    const {
        contSaludo,
        contCliente,
        contAsesor,
        contPago,
        contPoliza,
        contFechaPago,
        contComplemento,
    } = req.body

    const plantillaTexto = await pool.query(
        `
                      INSERT INTO
                          CARTERA.PLANTILLA_TEXTO_CARTERA 
                          (
                              SALUDO,
                              CONTENIDO_CLIENTE,
                              CONTENIDO_ASESOR,
                              CONTENIDO_PAGO,
                              CONTENIDO_POLIZA,
                              FECHA_PAGO,
                              COMPLEMENTO
                          )
                      VALUES($1,$2,$3,$4,$5,$6,$7)
                  `,
        contSaludo,
        contCliente,
        contAsesor,
        contPago,
        contPoliza,
        contFechaPago,
        contComplemento
    )

    res.json({
        msg: 'Registro plantilla texto exitoso!!',
    })
}

// const guardarPlantillaMail = (
//     asuntoIntro,
//     asuntoCliente,
//     asuntoPoliza,
//     contSaludo,
//     contCliente,
//     contInfoPago,
//     contPoliza,
//     contMesAdeudado,
//     contPagoDigital,
//     contFechaPago,
//     contMedioPago,
//     contPagoBancario,
//     contMostrarMedioPago,
//     contCierre,
//     contDespedida,
//     contComplemento,
//     contAdicional
// ) => {
//     const plantillaMail = pool.query(
//         `
//                   INSERT INTO
//                       CARTERA.PLANTILLA_MAIL_CARTERA
//                       (
//                           ASUNTO_INTRO,
//                           ASUNTO_CLIENTE,
//                           ASUNTO_POLIZA,
//                           CONTENIDO_SALUDO,
//                           CONTENIDO_CLIENTE,
//                           CONTENIDO_INFO_PAGO,
//                           CONTENIDO_POLIZA,
//                           CONTENIDO_MES_ADEUDADO,
//                           CONTENIDO_PAGO_DIGITAL,
//                           CONTENIDO_FECHA_PAGO,
//                           CONTENIDO_MEDIO_PAGO,
//                           CONTENIDO_PAGO_BANCARIO,
//                           CONTENIDO_MOSTRAR_MEDIO_PAGO,
//                           CONTENIDO_CIERRE,
//                           CONTENIDO_DESPEDIDA,
//                           CONTENIDO_COMPLEMENTO,
//                           CONTENIDO_ADICIONAL
//                       )
//                   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
//               `,
//         asuntoIntro,
//         asuntoCliente,
//         asuntoPoliza,
//         contSaludo,
//         contCliente,
//         contInfoPago,
//         contPoliza,
//         contMesAdeudado,
//         contPagoDigital,
//         contFechaPago,
//         contMedioPago,
//         contPagoBancario,
//         contMostrarMedioPago,
//         contCierre,
//         contDespedida,
//         contComplemento,
//         contAdicional
//     )
// }

// const guardarPlantillaTexto = (
//     contSaludo,
//     contCliente,
//     contAsesor,
//     contPago,
//     contPoliza,
//     contFechaPago,
//     contComplemento
// ) => {
//     const plantillaTexto = pool.query(
//         `
//                       INSERT INTO
//                           CARTERA.PLANTILLA_TEXTO_CARTERA
//                           (
//                               SALUDO,
//                               CONTENIDO_CLIENTE,
//                               CONTENIDO_ASESOR,
//                               CONTENIDO_PAGO,
//                               CONTENIDO_POLIZA,
//                               FECHA_PAGO,
//                               COMPLEMENTO
//                           )
//                       VALUES($1,$2,$3,$4,$5,$6,$7)
//                   `,
//         contSaludo,
//         contCliente,
//         contAsesor,
//         contPago,
//         contPoliza,
//         contFechaPago,
//         contComplemento
//     )
// }

export const guardarConfigCarteraEspecial = async (req, res) => {
    const {
        diasAviso,
        idTipoNotificaciones,
        idTipoNotificacionesActual,
        idPolizas,
        idDiasProceso,
        idConfEspecialCartera,
        idEnvioCarteraEspecial,
        idPlantillaMail,
        idPlantillaTexto,
    } = req.body

    //existe la configuración y se escoge otro tipo de notificación (quedan 2)
    if (idConfEspecialCartera != null && idTipoNotificaciones.length > 1) {
    } else if (
        idConfEspecialCartera != null &&
        idTipoNotificaciones.length === 1
    ) {
        //existe la configuración y se mantiene el tipo de notificación
    } else if (
        idConfEspecialCartera != null &&
        idTipoNotificaciones.length === 1 &&
        idTipoNotificaciones[0] != idTipoNotificacionesActual[0]
    ) {
        //existe la configuración se deselecciona la actual y se escoge el otro tipo de notificación

        const deleteConfigEspCartera = await pool.query(
            `
              DELETE FROM SISTEMA.CONFIGURACION_ESPECIAL_CARTERA WHERE ID_CONF_ESP_CARTERA = $1
          `,
            idConfEspecialCartera
        )

        if (idTipoNotificaciones[0] === 1) {
            const deletePlantillaMail = await pool.query(
                `
                  DELETE FROM SISTEMA.CONFIGURACION_ESPECIAL_CARTERA WHERE ID_CONF_ESP_CARTERA = $1
              `,
                idConfEspecialCartera
            )
        } else if (idTipoNotificaciones[0] === 2) {
            const deletePlantillaTexto = await pool.query(
                `
                  DELETE FROM SISTEMA.CONFIGURACION_ESPECIAL_CARTERA WHERE ID_CONF_ESP_CARTERA = $1
              `,
                idConfEspecialCartera
            )
        }
    } else if (
        idConfEspecialCartera == null &&
        idTipoNotificaciones.length > 1
    ) {
        //no existe configuración y se van a guardar los 2 tipos de notificaciones

        //Se guarda inicialmente en la tabla CONFIGURACION_ESPECIAL_CARTERA
        const configEspecialCartera = await pool.query(
            `
              INSERT INTO
                  SISTEMA.CONFIGURACION_ESPECIAL_CARTERA (DIAS)
              VALUES ($1)
          `,
            dias_cartera
        )

        //Se busca el ultimo id generado en la tabla CONFIGURACION_ESPECIAL_CARTERA
        const idConfEspecialCartera = await pool.query(`
              SELECT MAX(CEC.ID_CONF_ESP_CARTERA) FROM SISTEMA.CONFIGURACION_ESPECIAL_CARTERA AS CEC 
          `)

        idPolizas.forEach(function (idPoliza) {
            const confEspecialPoliza = pool.query(
                `
                      INSERT INTO
                          CARTERA.CONFIGURACION_ESPECIAL_POLIZAS 
                          (
                              ID_CONF_ESP_CARTERA,
                              ID_POLIZA
                          )
                      VALUES($1,$2) 
                  `,
                idConfEspecialCartera.rows.ID_CONF_ESP_CARTERA,
                idPoliza
            )
        })

        //Se guarda en la tabla ENVIO_CARTERA_ESPECIAL
        const envioCarteraEspecial = await pool.query(
            `
              INSERT INTO
                  CARTERA.ENVIO_CARTERA_ESPECIAL 
                  (
                      ID_DIAS_PROCESO,
                      ID_TIPO_NOTIFICACION,
                      ID_CONF_ESP_CARTERA,
                      ID_CICLO_NOTIFICACION
                  )
              VALUES ($1,$2,$3,$4)
          `,
            idDiasProceso,
            idTipoNotificaciones[0],
            idConfEspecialCartera.rows.ID_CONF_ESP_CARTERA,
            4
        )

        //Generamo guardado de las plantillas

        guardarPlantillaMail(
            asuntoIntro,
            asuntoCliente,
            asuntoPoliza,
            contSaludo,
            contCliente,
            contInfoPago,
            contPoliza,
            contMesAdeudado,
            contPagoDigital,
            contFechaPago,
            contMedioPago,
            contPagoBancario,
            contMostrarMedioPago,
            contCierre,
            contDespedida,
            contComplemento,
            contAdicional
        )

        const idPlantillaMail = await pool.query(`
                  SELECT MAX(PMC.ID_PLANTILLA_MAIL_CARTERA) FROM CARTERA.PLANTILLA_MAIL_CARTERA AS PMC 
              `)

        const idEnvioCarteraEspecial = await pool.query(`
                  SELECT MAX(ECE.ID_ENVIO_CARTERA_ESPECIAL) FROM CARTERA.ENVIO_CARTERA_ESPECIAL AS ECE 
              `)

        guardarPlantillaTexto(
            contSaludo,
            contCliente,
            contAsesor,
            contPago,
            contPoliza,
            contFechaPago,
            contComplemento
        )

        const idPlantillaTexto = await pool.query(`
                  SELECT MAX(PTC.ID_PLANTILLA_TEXTO_CARTERA) FROM CARTERA.PLANTILLA_TEXTO_CARTERA AS PTC  
              `)

        const plantillaEnvioCartera = await pool.query(
            `
                  INSERT INTO
                      CARTERA.PLANTILLA_ENVIO_CARTERA 
                      (
                          ID_PLANTILLA_MAIL_CARTERA,
                          ID_PLANTILLA_TEXTO_CARTERA,
                          ID_ENVIO_CARTERA_ESPECIAL,
                      )
                  VALUES($1,$2,$3);
              `,
            idPlantillaMail.rows.ID_PLANTILLA_MAIL_CARTERA,
            idPlantillaTexto.rows.ID_PLANTILLA_TEXTO_CARTERA,
            idEnvioCarteraEspecial.rows.ID_ENVIO_CARTERA_ESPECIAL
        )
    } else if (
        idConfEspecialCartera != null &&
        idTipoNotificaciones.length === 1
    ) {
        //no existe y se va a guardar solo un tipo de notificacion

        //Se guarda inicialmente en la tabla CONFIGURACION_ESPECIAL_CARTERA
        const configEspecialCartera = await pool.query(
            `
              INSERT INTO
                  SISTEMA.CONFIGURACION_ESPECIAL_CARTERA (DIAS)
              VALUES ($1)
          `,
            dias_cartera
        )

        //Se busca el ultimo id generado en la tabla CONFIGURACION_ESPECIAL_CARTERA
        const idConfEspecialCartera = await pool.query(`
              SELECT MAX(CEC.ID_CONF_ESP_CARTERA) FROM SISTEMA.CONFIGURACION_ESPECIAL_CARTERA AS CEC 
          `)

        idPolizas.forEach(function (idPoliza) {
            const confEspecialPoliza = pool.query(
                `
                      INSERT INTO
                          CARTERA.CONFIGURACION_ESPECIAL_POLIZAS 
                          (
                              ID_CONF_ESP_CARTERA,
                              ID_POLIZA
                          )
                      VALUES($1,$2) 
                  `,
                idConfEspecialCartera.rows.ID_CONF_ESP_CARTERA,
                idPoliza
            )
        })

        //Se guarda en la tabla ENVIO_CARTERA_ESPECIAL
        const envioCarteraEspecial = await pool.query(
            `
              INSERT INTO
                  CARTERA.ENVIO_CARTERA_ESPECIAL 
                  (
                      ID_DIAS_PROCESO,
                      ID_TIPO_NOTIFICACION,
                      ID_CONF_ESP_CARTERA,
                      ID_CICLO_NOTIFICACION
                  )
              VALUES ($1,$2,$3,$4)
          `,
            idDiasProceso,
            idTipoNotificaciones[0],
            idConfEspecialCartera.rows.ID_CONF_ESP_CARTERA,
            4
        )

        //Generamo guardado de la plantilla segun sea el idTipoNotificacion
        if (idTipoNotificaciones[0] === 1) {
            guardarPlantillaMail(
                asuntoIntro,
                asuntoCliente,
                asuntoPoliza,
                contSaludo,
                contCliente,
                contInfoPago,
                contPoliza,
                contMesAdeudado,
                contPagoDigital,
                contFechaPago,
                contMedioPago,
                contPagoBancario,
                contMostrarMedioPago,
                contCierre,
                contDespedida,
                contComplemento,
                contAdicional
            )

            const idPlantillaMail = await pool.query(`
                  SELECT MAX(PMC.ID_PLANTILLA_MAIL_CARTERA) FROM CARTERA.PLANTILLA_MAIL_CARTERA AS PMC 
              `)

            const idEnvioCarteraEspecial = await pool.query(`
                  SELECT MAX(ECE.ID_ENVIO_CARTERA_ESPECIAL) FROM CARTERA.ENVIO_CARTERA_ESPECIAL AS ECE 
              `)

            const plantillaEnvioCartera = await pool.query(
                `
                  INSERT INTO
                      CARTERA.PLANTILLA_ENVIO_CARTERA 
                      (
                          ID_PLANTILLA_MAIL_CARTERA,
                          ID_ENVIO_CARTERA_ESPECIAL,
                      )
                  VALUES($1,$2);
              `,
                idPlantillaMail.rows.ID_PLANTILLA_MAIL_CARTERA,
                idEnvioCarteraEspecial.rows.ID_ENVIO_CARTERA_ESPECIAL
            )
        } else if (idTipoNotificaciones[0] === 2) {
            guardarPlantillaTexto(
                contSaludo,
                contCliente,
                contAsesor,
                contPago,
                contPoliza,
                contFechaPago,
                contComplemento
            )

            const idConfEspecialCartera = await pool.query(`
                  SELECT MAX(PTC.ID_PLANTILLA_TEXTO_CARTERA) FROM CARTERA.PLANTILLA_TEXTO_CARTERA AS PTC  
              `)

            const idEnvioCarteraEspecial = await pool.query(`
                  SELECT MAX(ECE.ID_ENVIO_CARTERA_ESPECIAL) FROM CARTERA.ENVIO_CARTERA_ESPECIAL AS ECE 
              `)

            const plantillaEnvioCartera = await pool.query(
                `
                  INSERT INTO
                      CARTERA.PLANTILLA_ENVIO_CARTERA 
                      (
                          ID_PLANTILLA_TEXTO_CARTERA,
                          ID_ENVIO_CARTERA_ESPECIAL,
                      )
                  VALUES($1,$2);
              `,
                idPlantillaTexto.rows.ID_PLANTILLA_TEXTO_CARTERA,
                idEnvioCarteraEspecial.rows.ID_ENVIO_CARTERA_ESPECIAL
            )
        }
    }

    res.json({
        msg: 'Registro configuración cartera especial exitoso!!',
    })
}

export const actualizarConfigCarteraEspecial = async (req, res) => {
    const { id_configuracion, id_cartera_dias, id_tipo_notificacion } = req.body

    const configGralCartera = await pool.query(
        `
          UPDATE 
              SISTEMA.CONFIGURACION_ESPECIAL_CARTERA CEC
          SET
              CEC.FECHA_ACTUALIZACION = CURRENT_TIMESTAMP 
          WHERE 
              CEC.ID_CONF_ESP_CARTERA = $1
              AND CEC.ID_POLIZA = $2
      `,
        id_configuracion,
        id_poliza
    )

    const envioCarteraGral = await pool.query(
        `
          UPDATE 
              CARTERA.ENVIO_CARTERA_ESPECIAL ECE 
          SET 
              ECE.ID_DIAS_PROCESO = $1,
              ECE.ID_TIPO_NOTIFICACION = $2,
              ECE.FECHA_ACTUALIZACION = CURRENT_TIMESTAMP
          WHERE 
              ECE.ID_CONF_ESP_CARTERA = $3
      `,
        id_cartera_dias,
        id_tipo_notificacion,
        id_configuracion
    )

    res.json({
        msg: 'Actualización configuración cartera especial exitoso!!',
    })
}

export const eliminarConfigCarteraEspecial = async (req, res) => {
    const { id_configuracion, dias } = req.body

    const plantillaMail = await pool.query(
        `
          DELETE FROM CARTERA.PLANTILLA_MAIL_CARTERA PMC WHERE PMC.ID_PLANTILLA_MAIL_CARTERA = (
              SELECT 
                  PEC.ID_PLANTILLA_MAIL_CARTERA 
              FROM
                  CARTERA.PLANTILLA_ENVIO_CARTERA PEC 
                      INNER JOIN CARTERA.ENVIO_CARTERA_ESPECIAL ECE ON ECE.ID_ENVIO_CARTERA_ESPECIAL = PEC.ID_ENVIO_CARTERA_ESPECIAL 
                          INNER JOIN SISTEMA.CONFIGURACION_ESPECIAL_CARTERA CEC ON CEC.ID_CONF_ESP_CARTERA = ECE.ID_CONF_ESP_CARTERA
                          INNER JOIN "general".DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = ECE.ID_DIAS_PROCESO 
              WHERE
                  CEC.ID_CONF_ESP_CARTERA = $1
                  AND DPP.DIAS = $2
          );	
      `,
        [id_configuracion, dias]
    )

    const plantillaTexto = await pool.query(
        `
          DELETE FROM CARTERA.PLANTILLA_TEXTO_CARTERA PTC WHERE PTC.ID_PLANTILLA_TEXTO_CARTERA = (
              SELECT 
                  PEC.ID_PLANTILLA_TEXTO_CARTERA 
              FROM
                  CARTERA.PLANTILLA_ENVIO_CARTERA PEC 
                      INNER JOIN CARTERA.ENVIO_CARTERA_ESPECIAL ECE ON ECE.ID_ENVIO_CARTERA_ESPECIAL = PEC.ID_ENVIO_CARTERA_ESPECIAL 
                          INNER JOIN SISTEMA.CONFIGURACION_ESPECIAL_CARTERA CEC ON CEC.ID_CONF_ESP_CARTERA = ECE.ID_CONF_ESP_CARTERA
                          INNER JOIN "general".DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = ECE.ID_DIAS_PROCESO 
              WHERE
                  CEC.ID_CONF_ESP_CARTERA = $1
                  AND DPP.DIAS = $2
          );	 
      `,
        [id_configuracion, dias]
    )

    const plantillaEnvioMail = await pool.query(
        `
          DELETE FROM CARTERA.PLANTILLA_ENVIO_CARTERA PEC WHERE PEC.ID_PLANTILLA_ENVIO_CARTERA = (
              SELECT 
                  PEC.ID_PLANTILLA_ENVIO_CARTERA 
              FROM
                  CARTERA.PLANTILLA_ENVIO_CARTERA PEC 
                      INNER JOIN CARTERA.ENVIO_CARTERA_ESPECIAL ECE ON ECE.ID_ENVIO_CARTERA_ESPECIAL = PEC.ID_ENVIO_CARTERA_ESPECIAL 
                          INNER JOIN SISTEMA.CONFIGURACION_ESPECIAL_CARTERA CEC ON CEC.ID_CONF_ESP_CARTERA = ECE.ID_CONF_ESP_CARTERA
                          INNER JOIN "general".DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = ECE.ID_DIAS_PROCESO 
              WHERE
                  CEC.ID_CONF_ESP_CARTERA = $1
                  AND DPP.DIAS = $2
          );
      `,
        [id_configuracion, dias]
    )

    const plantillaEnvioTexto = await pool.query(
        `
          DELETE FROM CARTERA.PLANTILLA_ENVIO_CARTERA PEC WHERE PEC.ID_PLANTILLA_ENVIO_CARTERA = (
              SELECT 
                  PEC.ID_PLANTILLA_ENVIO_CARTERA 
              FROM
                  CARTERA.PLANTILLA_ENVIO_CARTERA PEC 
                      INNER JOIN CARTERA.ENVIO_CARTERA_ESPECIAL ECE ON ECE.ID_ENVIO_CARTERA_ESPECIAL = PEC.ID_ENVIO_CARTERA_ESPECIAL 
                          INNER JOIN SISTEMA.CONFIGURACION_ESPECIAL_CARTERA CEC ON CEC.ID_CONF_ESP_CARTERA = ECE.ID_CONF_ESP_CARTERA
                          INNER JOIN "general".DIAS_POR_PROCESO DPP ON DPP.ID_DIAS_PROCESO = ECE.ID_DIAS_PROCESO 
              WHERE
                  CEC.ID_CONF_ESP_CARTERA = $1
                  AND DPP.DIAS = $2
          );
      `,
        [id_configuracion, dias]
    )

    const envioCartera = await pool.query(
        `
          DELETE FROM CARTERA.ENVIO_CARTERA_ESPECIAL ECE WHERE ECE.ID_CONF_ESP_CARTERA = $1
      `,
        [id_configuracion]
    )

    const configCartera = await pool.query(
        `
          DELETE FROM SISTEMA.CONFIGURACION_ESPECIAL_CARTERA CEC WHERE CEC.ID_CONF_ESP_CARTERA = $1 
      `,
        [id_configuracion]
    )

    res.json({
        msg: 'Eliminación de configuración de cartera especial exitosa!!',
    })
}

export const guardarConfigRenovacion = async (req, res) => {
    const { id_asesor, fecha_renovacion, fecha_soat } = req.body

    const get_registro = await pool.query(`
          SELECT MAX(id_configuracion) + 1 AS id_configuracion FROM configuraciones_generales
      `)

    const id_configuracion = get_registro.rows[0].id_configuracion

    const general = await pool.query(
        `
          INSERT INTO 
              configuraciones_generales 
          (id_configuracion, id_asesor, dia_renovacion, dia_soat, fecha_registro, fecha_actualizacion)
          VALUES 
          ($1, $2, $3, $4, now(), now())
      `,
        [id_configuracion, id_asesor, fecha_renovacion, fecha_soat]
    )

    res.json({
        msg: 'Registro configuraciOn renovaciOn exitoso!!',
    })
}

export const actualizarConfigRenovacion = async (req, res) => {
    const { id_configuracion, id_asesor, fecha_renovacion, fecha_soat } =
        req.body

    const general = await pool.query(
        `
          UPDATE 
              configuraciones_generales 
          SET 
              id_asesor = $2, 
              dia_renovacion = $3, 
              dia_soat = $4, 
              fecha_actualizacion = NOW()
          WHERE 
              id_configuracion = $1 
      `,
        [id_configuracion, id_asesor, fecha_renovacion, fecha_soat]
    )

    res.json({
        msg: 'ActualizaciOn configuraciOn renovaciOn exitoso!!',
    })
}

export const guardarConfigFacturacion = async (req, res) => {
    const { id_asesor, id_tomador, id_poliza, tipo, fecha_facturacion } =
        req.body

    if (id_tomador === '' || id_tomador === null) {
        const get_registro = await pool.query(`
              SELECT MAX(id_configuracion) + 1 AS id_configuracion FROM configuraciones_generales
          `)

        const id_configuracion = get_registro.rows[0].id_configuracion

        const general = await pool.query(
            `
              INSERT INTO 
                  configuraciones_generales 
              (id_configuracion, id_asesor, tipo_facturacion, fecha_facturacion, fecha_registro, fecha_actualizacion)
              VALUES 
              ($1, $2, $3, $4, now(), now())
          `,
            [id_configuracion, id_asesor, tipo, fecha_facturacion]
        )
    } else {
        const get_registro = await pool.query(`
              SELECT MAX(id_configuracion) + 1 AS id_configuracion FROM configuracion_especial_facturacion
          `)

        const id_configuracion = get_registro.rows[0].id_configuracion

        const general = await pool.query(
            `
              INSERT INTO 
                  configuracion_especial_facturacion 
              VALUES ( 
                  $1, $2, $3, $4, $5, $6, now(), now()
              )
          `,
            [
                id_configuracion,
                id_asesor,
                id_tomador,
                id_poliza,
                tipo,
                fecha_facturacion,
            ]
        )
    }

    res.json({
        msg: 'Registro configuraciOn facturaciOn exitoso!!',
    })
}

export const actualizarConfigFacturacion = async (req, res) => {
    const {
        id_configuracion,
        id_asesor,
        id_tomador,
        id_poliza,
        tipo,
        fecha_facturacion,
    } = req.body

    if (id_tomador === '' || id_tomador === null) {
        const general = await pool.query(
            `
              UPDATE 
                  configuraciones_generales 
              SET 
                  id_asesor = $2, 
                  tipo_facturacion = $3, 
                  fecha_facturacion = $4, 
                  fecha_actualizacion = NOW()
              WHERE 
                  id_configuracion = $1 
          `,
            [id_configuracion, id_asesor, tipo, fecha_facturacion]
        )
    } else {
        const general = await pool.query(
            `
              UPDATE 
                  configuracion_especial_facturacion 
              SET 
                  id_asesor = $2, 
                  id_tomador = $3, 
                  id_poliza = $4, 
                  tipo = $5, 
                  fecha_facturacion = $6, 
                  fecha_actualizacion = NOW()
              WHERE 
                  id_configuracion = $1 
          `,
            [
                id_configuracion,
                id_asesor,
                id_tomador,
                id_poliza,
                tipo,
                fecha_facturacion,
            ]
        )
    }

    res.json({
        msg: 'ActualizaciOn configuraciOn facturaciOn exitoso!!',
    })
}

export const eliminarConfigFacturacion = async (req, res) => {
    const { id_configuracion } = req.body

    const item = await pool.query(
        `
          DELETE FROM 
              configuracion_especial_facturacion 
          WHERE 
              id_configuracion = $1 
      `,
        [id_configuracion]
    )

    res.json({
        msg: 'EliminaciOn configuraciOn facturaciOn exitoso!!',
    })
}

export const cargarSoportes = async (req, res) => {
    const guias = await pool.query(`
          SELECT 
              G.ID_GUIA,
              G.GUIA,
              G.DESCRIPCION,
              G.FECHA_ACTUALIZACION 
          FROM 
              "general".GUIAS G
      `)
    const faqs = await pool.query(`
          SELECT 
              F.ID_FAQ,
              F.FAQ,
              F.DESCRIPCION,
              F.FECHA_ACTUALIZACION 
          FROM 
              "general".FAQS F 
      `)

    res.json([guias.rows, faqs.rows])
}

export const wpSession = async (req, res) => {
    const { id_asesor } = req.decodedUser
    const data = {
        idAsesor: id_asesor,
    }
    const options = {
        url: 'http://45.93.100.36:7789/api/wp-session',
    }

    try {
        // const response = await sendPost(data, options);
        const response = {}
        if (response.data) {
            res.status(200).json({
                messageStatus: response.data,
            })
            return
        }

        res.status(404)
    } catch (error) {
        console.error(error)
        res.status(400)
        return
    }
}
