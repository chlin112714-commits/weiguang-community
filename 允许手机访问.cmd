@echo off
chcp 65001 >nul
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 请右键这个文件，选择“以管理员身份运行”。
    pause
    exit /b 1
)

netsh advfirewall firewall delete rule name="MySite Mobile Access 5173" >nul 2>&1
netsh advfirewall firewall add rule name="MySite Mobile Access 5173" dir=in action=allow protocol=TCP localport=5173 profile=any

if %errorlevel% equ 0 (
    echo.
    echo 防火墙已放行，手机可以访问：http://10.76.71.35:5173/
) else (
    echo.
    echo 放行失败，请确认使用的是“以管理员身份运行”。
)
pause
