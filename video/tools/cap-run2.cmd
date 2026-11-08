@echo off
cd /d C:\Users\Asus\orca\workspaces\demobondisok\video-explicativo-vertical\video
set ONLY=4,5,6,7,8
"C:\Program Files\nodejs\node.exe" tools\capture3.mjs > capture2\capture3-run2.log 2>&1
echo EXIT=%ERRORLEVEL% >> capture2\capture3-run2.log
