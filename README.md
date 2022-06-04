# Backpro Info Server

Project Deployed in our server

## Pre requisites

Node js 16.13.2
firebase cli @latest

### how to install?

-   run `npm install`
-   copy .envsample content and paste it .env file
-   run `npm run start`
-   Generate a key and a certificate https server

## How to Deploy https server

1. Generate a private key:
   `opensssl genrsa -out key.pem`
2. Create a CSR (certificate signin request) usign private key

    - `openssl req -new -key key.pem -out csr.pem`
    - It may require email adress
    - It may require a password

3. Generate the SSL certification from CSR
    - `openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out cert.pem`
    - delete csr.pem file

### To deploy you must

Log in gcloud and run an instance of pm2 `pm2 start npm -- start`
