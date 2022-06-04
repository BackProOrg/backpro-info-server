import pkg from 'pg'
const { Pool } = pkg
import config from '../common/config'

console.log(config.DATABASE.CONNECTIONSTRING)

const pool = new Pool({
    connectionString: config.DATABASE.CONNECTIONSTRING,
    ssl: {
        rejectUnauthorized: false,
    },
    max: 5,
})

pool.connect((err) => {
    if (err) {
        console.log('connection error:', err)
    } else {
        console.log('Conexión de desarrollo establecida con la DB!')
    }
})

export default pool
