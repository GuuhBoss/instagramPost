const axios = require('axios');
const fs = require('fs');

module.exports = {
    newUrl: async (path) => {
        let result;
        const clientId = process.env.CLIENT_ID;

        // Ler o arquivo de imagem em um buffer
        const imageData = fs.readFileSync(path);

        // Configurar a solicitação HTTP POST para a API do Imgur
        const config = {
            headers: {
                'Authorization': `Client-ID ${clientId}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        // Enviar a solicitação HTTP POST para a API do Imgur
        await axios.post('https://api.imgur.com/3/image', imageData, config)
            .then(response => {
                // console.log(response.data.data.link);
                result =  response.data.data.link
            })
            .catch(error => {
                console.error(error);
            });

        return result
    }
}