const express = require('express');
const sql = require('mssql');
const bcrypt = require('bcrypt');
const app = express();
const port = 3000;

app.use(express.json());

const config = {
    user: 'sa',
    password: 'TMPdb1124',
    server: 'localhost',
    database: 'HotParts',
};

app.post('/api/login', async (req, res) => {
    const { nomina, password } = req.body;

    try {
        await sql.connect(config);

        const result = await sql.query(
            'SELECT * FROM Usuarios WHERE Nomina = @nomina',
            {
                nomina: sql.VarChar(50)
            }
        );

        if (result.recordset.length > 0) {
            const user = result.recordset[0];

            const isPasswordValid = await bcrypt.compare(password, user.Password);

            if (isPasswordValid) {
                res.json({ success: true, user: user });
            } else {
                res.json({ success: false, message: 'Credenciales incorrectas' });
            }
        } else {
            res.json({ success: false, message: 'Credenciales incorrectas' });
        }

        await sql.close();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error de servidor' });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
