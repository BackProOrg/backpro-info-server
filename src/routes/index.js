export function init(app) {
    app.use('/api', (req, res) => {
        res.status(200).json({
            message: 'server running',
        })
    })
}
