@ECHO OFF
:go
node --max_old_space_size=8096 main.js
pause
goto go