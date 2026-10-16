-- Ensure untitled_judge database exists
SELECT 'CREATE DATABASE untitled_judge'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'untitled_judge')\gexec

