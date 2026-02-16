// Passenger (Hostinger Shared Hosting) Entry Point
// This file wraps the Next.js standalone server for Phusion Passenger

const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');

// Set environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';
process.env.HOSTNAME = '0.0.0.0';

// Next.js standalone server
const next = require('./server.js');
