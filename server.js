const express = require('express');
const cors = require('cors');

const app = express();
app.get('/ping', (req, res) => res.json({ ok: true }));

app.use(cors({
    origin: [
        'https://simulador-frutas.netlify.app',
        'https://www.simulador-frutas.netlify.app',
        'https://simulador-supermercado.netlify.app',
        'https://www.simulador-supermercado.netlify.app',
        'http://localhost:3000',
        'http://127.0.0.1:5500',
        'https://al397098.github.io'
    ]
}));
app.use(express.json());

// ==========================================================
// 🧠 MOTOR MATEMÁTICO (Aislado y protegido en el servidor)
// ==========================================================
const COEF_AMB = [38.7286, 0.3473, 306.8522];
const COEF_SOC = [2.55, 0.024, 11.23];
const COEF_ECO = [0.16, 0.00223, 2.69];

const calc_dist = (p, a, s, pr_p, pr_a, pr_s) => Math.sqrt(Math.pow(p - pr_p, 2) + Math.pow(a - pr_a, 2) + Math.pow(s - pr_s, 2));
const calc_S10 = (i_stk, merma, i_maq) => { if (merma >= 1) return 0; const denom = (i_stk / (1 - merma)) - i_maq; return denom <= 0 ? 0 : 1 - (i_stk / denom); };

function evaluarEscenario(fs, mq) {
    let tS = fs.reduce((s, f) => s + f.stock, 0), tD = fs.reduce((s, f) => s + (f.stock * f.merma), 0);
    if (tS === 0) return null;
    let pa = 0, ps = 0, pe = 0;
    fs.forEach(f => { let d = f.stock * f.merma; pa += f.imp.a * d; ps += f.imp.s * d; pe += f.imp.e * d; });
    pa /= tD; ps /= tD; pe /= tD;

    let mD = Infinity, ip = -1, ds = [];
    fs.forEach((f, i) => {
        let d = calc_dist(f.imp.e, f.imp.a, f.imp.s, pe, pa, ps); ds.push(d);
        if (d < mD) { mD = d; ip = i; }
    });

    let PR = fs[ip], sI = ds.reduce((s, d) => s + (1 / (d + 0.001)), 0), pR = ds.map(d => (1 / (d + 0.001)) / sI), mg = tD / tS;
    let ca = calc_S10(tS * PR.imp.a, mg, mq.i_a), cs = calc_S10(tS * PR.imp.s, mg, mq.i_s), ce = calc_S10(tS * PR.imp.e, mg, mq.i_e);
    let um = [tD - (tS * ca), tD - (tS * cs), tD - (tS * ce)], uM = Math.max(...um), lim = ['Ambiental', 'Social', 'Económico'][um.indexOf(uM)];
    let i0a = 0, i0s = 0, i0e = 0;
    fs.forEach(f => { let d = f.stock * f.merma; i0a += d * f.imp.a; i0s += d * f.imp.s; i0e += d * f.imp.e; });

    return { maquina: mq, PR, limitante: lim, umbrales: um, umbral_max: uM, total_stk: tS, total_desp: tD, pesos_rep: pR, imp0_a: i0a, imp0_s: i0s, imp0_e: i0e, frutas: fs };
}

// ==========================================================
// 🌐 API REST
// ==========================================================

app.post('/api/auditoria', (req, res) => {
    try {
        const inventario = req.body.inventario;
        const maquinas = req.body.maquinas;

        if (!inventario || inventario.length === 0) {
            return res.status(400).json({ exito: false, error: "Inventario vacío" });
        }

        const resultadoBase = evaluarEscenario(inventario, { i_a: 0, i_s: 0, i_e: 0 });
        const resultadosMaquinas = maquinas.map(mq => evaluarEscenario(inventario, mq));

        res.json({
            exito: true,
            resultadoBase: resultadoBase,
            resultadosMaquinas: resultadosMaquinas
        });

    } catch (error) {
        console.error("Error en el cálculo:", error);
        res.status(500).json({ exito: false, error: "Error interno del servidor" });
    }
});

// ==========================================================
// 🔐 VERIFICACIÓN DE ADMIN (contraseña nunca sale del servidor)
// ==========================================================

app.post('/api/verificar-admin', (req, res) => {
    const { pwd } = req.body;
    const PWD_ADMIN = process.env.ADMIN_PASSWORD;

    if (!PWD_ADMIN) {
        return res.status(500).json({ ok: false, error: 'Variable de entorno no configurada' });
    }

    if (pwd === PWD_ADMIN) {
        res.json({ ok: true });
    } else {
        setTimeout(() => {
            res.status(401).json({ ok: false });
        }, 1000);
    }
});

// ==========================================================
// 🚀 ARRANCAR SERVIDOR
// ==========================================================
const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
    console.log(`✅ Servidor corriendo en puerto ${PUERTO}`);
});