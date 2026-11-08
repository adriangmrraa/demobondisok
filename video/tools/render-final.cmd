@echo off
cd /d C:\Users\Asus\orca\workspaces\demobondisok\video-explicativo-vertical\video
set WORKERS=4
"C:\Program Files\nodejs\node.exe" render\render.mjs > out\render.log 2>&1
echo EXIT=%ERRORLEVEL% >> out\render.log
