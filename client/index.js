import express from 'express';
import bodyParser from 'body-parser';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import https from 'https'; // Добавляем модуль https
import fs from 'fs'; // Добавляем модуль fs для чтения сертификатов

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;
const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 12347;

const sslOptions = {
    key: fs.readFileSync('server.key'), // Путь к приватному ключу
    cert: fs.readFileSync('server.crt') // Путь к сертификату
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/vote', async (req, res) => {
    try {
        const { voterId, candidateId, privateKey, publicKey } = req.body;

        // Валидация
        if (!voterId || !candidateId || !privateKey || !publicKey) {
            throw new Error('Все поля обязательны для заполнения');
        }

        // Генерация подписи
        const nonce = crypto.randomInt(100000, 999999);
        const dataToSign = `${voterId}|${candidateId}|${nonce}`;

        const signature = crypto.sign(
            null,
            Buffer.from(dataToSign),
            crypto.createPrivateKey(privateKey)
        ).toString('base64');

        // Формирование голоса
        const vote = {
            voterId,
            candidateId,
            nonce,
            signature,
            publicKey
        };

        // Отправка на TCP-сервер
        const response = await sendToServer(vote);

        res.json({
            success: true,
            message: 'Голос успешно отправлен',
            serverResponse: response,
            voteDetails: vote
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

function sendToServer(vote) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        const message = {
            type: "TRANSACTION",
            data: vote
        };

        client.connect(SERVER_PORT, SERVER_HOST, () => {
            client.write(JSON.stringify(message));
            client.end();
        });

        client.on('data', data => {
            resolve(data.toString());
            client.destroy();
        });

        client.on('error', err => {
            reject(err);
        });

        client.setTimeout(5000, () => {
            client.destroy();
            reject(new Error('Таймаут подключения'));
        });
    });
}

// Создаем HTTPS сервер вместо обычного HTTP
https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`HTTPS server running on https://localhost:${PORT}`);
});

// server.js
// import express from 'express';
// import bodyParser from 'body-parser';
// import net from 'net';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import crypto from 'crypto';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));

// const app = express();
// const PORT = 3000;
// const SERVER_HOST = '127.0.0.1';
// const SERVER_PORT = 12347;

// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());
// app.use(express.static('public'));

// // Routes
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// app.post('/vote', async (req, res) => {
//     try {
//         const { voterId, candidateId, privateKey, publicKey } = req.body;

//         // Валидация
//         if (!voterId || !candidateId || !privateKey || !publicKey) {
//             throw new Error('Все поля обязательны для заполнения');
//         }

//         // Генерация подписи
//         const nonce = crypto.randomInt(100000, 999999);
//         const dataToSign = `${voterId}|${candidateId}|${nonce}`;

//         const signature = crypto.sign(
//             null,
//             Buffer.from(dataToSign),
//             crypto.createPrivateKey(privateKey)
//         ).toString('base64');

//         // Формирование голоса
//         const vote = {
//             voterId,
//             candidateId,
//             nonce,
//             signature,
//             publicKey
//         };

//         // Отправка на TCP-сервер
//         const response = await sendToServer(vote);

//         res.json({
//             success: true,
//             message: 'Голос успешно отправлен',
//             serverResponse: response,
//             voteDetails: vote
//         });
//     } catch (error) {
//         res.status(400).json({
//             success: false,
//             message: error.message
//         });
//     }
// });

// function sendToServer(vote) {
//     return new Promise((resolve, reject) => {
//         const client = new net.Socket();
//         const message = {
//             type: "TRANSACTION",
//             data: vote
//         };

//         client.connect(SERVER_PORT, SERVER_HOST, () => {
//             client.write(JSON.stringify(message));
//             client.end();
//         });

//         client.on('data', data => {
//             resolve(data.toString());
//             client.destroy();
//         });

//         client.on('error', err => {
//             reject(err);
//         });

//         client.setTimeout(5000, () => {
//             client.destroy();
//             reject(new Error('Таймаут подключения'));
//         });
//     });
// }

// app.listen(PORT, () => {
//     console.log(`Web server running on http://localhost:${PORT}`);
// });

// import net from 'net';
// import crypto from 'crypto';
// import inquirer from 'inquirer';
// import fs from 'fs';
// import chalk from 'chalk';

// // Конфигурация сервера
// const SERVER_HOST = '127.0.0.1';
// const SERVER_PORT = 12347;

// async function main() {
//     console.log(chalk.yellow.bold('\n=== Voting Client ===\n'));

//     // Запрос данных у пользователя
//     const answers = await inquirer.prompt([
//         {
//             type: 'input',
//             name: 'voterId',
//             message: 'Enter your Voter ID:',
//             default: 'voter35',
//             validate: input => input.trim() ? true : 'Voter ID cannot be empty'
//         },
//         {
//             type: 'input',
//             name: 'candidateId',
//             message: 'Enter Candidate ID:',
//             validate: input => input.trim() ? true : 'Candidate ID cannot be empty'
//         },
//         {
//             type: 'list',
//             name: 'keySource',
//             message: 'How would you like to provide keys?',
//             choices: ['Paste PEM keys', 'Load from files']
//         },
//         {
//             type: 'input',
//             name: 'privateKey',
//             message: 'Paste your PRIVATE KEY (PEM format):',
//             when: answers => answers.keySource === 'Paste PEM keys',
//             validate: validatePemKey
//         },
//         {
//             type: 'input',
//             name: 'publicKey',
//             message: 'Paste your PUBLIC KEY (PEM format):',
//             when: answers => answers.keySource === 'Paste PEM keys',
//             validate: validatePemKey
//         },
//         {
//             type: 'input',
//             name: 'privateKeyFile',
//             message: 'Enter path to PRIVATE KEY file:',
//             when: answers => answers.keySource === 'Load from files',
//             validate: validateFile
//         },
//         {
//             type: 'input',
//             name: 'publicKeyFile',
//             message: 'Enter path to PUBLIC KEY file:',
//             when: answers => answers.keySource === 'Load from files',
//             validate: validateFile
//         }
//     ]);

//     // Загрузка ключей
//     let { privateKey, publicKey } = answers;

//     if (answers.keySource === 'Load from files') {
//         privateKey = fs.readFileSync(answers.privateKeyFile, 'utf8');
//         publicKey = fs.readFileSync(answers.publicKeyFile, 'utf8');
//     }

//     // Создание голоса
//     const vote = createVote(
//         answers.voterId.trim(),
//         answers.candidateId.trim(),
//         privateKey.trim(),
//         publicKey.trim()
//     );

//     // Отправка голоса
//     sendVote(vote);
// }

// function validatePemKey(input) {
//     return input.includes('-----BEGIN') &&
//         input.includes('-----END') ? true : 'Invalid PEM format';
// }

// function validateFile(input) {
//     try {
//         fs.accessSync(input, fs.constants.R_OK);
//         return true;
//     } catch {
//         return 'File not found or inaccessible';
//     }
// }

// function signVote(data, privateKeyPem) {
//     try {
//         const privateKey = crypto.createPrivateKey({
//             key: privateKeyPem,
//             format: 'pem'
//         });

//         return crypto.sign(null, Buffer.from(data), privateKey).toString('base64');
//     } catch (error) {
//         console.error(chalk.red('Error signing vote:'), error.message);
//         process.exit(1);
//     }
// }

// function createVote(voterId, candidateId, privateKeyPem, publicKeyPem) {
//     const nonce = crypto.randomInt(100000, 999999);
//     const dataToSign = `${voterId}|${candidateId}|${nonce}`;

//     return {
//         voterId,
//         candidateId,
//         nonce,
//         signature: signVote(dataToSign, privateKeyPem),
//         publicKey: publicKeyPem
//     };
// }

// function sendVote(vote) {
//     const client = new net.Socket();
//     const message = {
//         type: "TRANSACTION",
//         data: vote
//     };

//     client.connect(SERVER_PORT, SERVER_HOST, () => {
//         console.log(chalk.yellow('\nConnecting to server...'));
//         client.write(JSON.stringify(message));
//         console.log(chalk.green('Vote successfully sent!'));
//         console.log(chalk.blue('Details:'));
//         console.log(`- Voter: ${vote.voterId}`);
//         console.log(`- Candidate: ${vote.candidateId}`);
//         console.log(`- Nonce: ${vote.nonce}`);
//     });

//     client.on('data', data => {
//         console.log(chalk.cyan('\nServer response:'), data.toString());
//         client.destroy();
//     });

//     client.on('error', err => {
//         console.error(chalk.red('Connection error:'), err.message);
//     });

//     client.on('close', () => {
//         console.log(chalk.yellow('\nConnection closed'));
//     });
// }

// // Запуск приложения
// main().catch(error => {
//     console.error(chalk.red('Fatal error:'), error);
//     process.exit(1);
// });