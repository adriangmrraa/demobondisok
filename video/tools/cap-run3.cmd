@echo off
cd /d C:\Users\Asus\orca\workspaces\demobondisok\video-explicativo-vertical\video
set ONLY=6,7,8
"C:\Program Files\nodejs\node.exe" tools\capture3.mjs > capture2\capture3-run3.log 2>&1
echo EXIT=%ERRORLEVEL% >> capture2\capture3-run3.log
