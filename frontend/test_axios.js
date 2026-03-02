const axios = require('axios');

async function testApi() {
    console.log('Starting API test to http://localhost:8000/api/diagnosis/analyze');
    try {
        const res = await axios.post('http://localhost:8000/api/diagnosis/analyze', {
            symptoms: ['headache', 'fever']
        }, {
            headers: {
                'Content-Type': 'application/json'
                // Simulating CORS origin from Vite
            }
        });
        console.log('SUCCESS!');
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('ERROR!');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        } else {
            console.error('Message:', err.message);
        }
    }
}

testApi();
