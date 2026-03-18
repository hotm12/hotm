@echo off
setlocal

set "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/seller_find"

call %*
