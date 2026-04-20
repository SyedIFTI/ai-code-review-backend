import app from './src/app';
import http from 'http'
const server = http.createServer(app)
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
