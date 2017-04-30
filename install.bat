@ECHO OFF
CD %~dp0
npm install steamauth > install.log
npm install steam-user >> install.log
npm install steamcommunity >> install.log
npm install jsdom@9.12.0 >> install.log
npm install fs >> install.log
npm install request >> install.log
npm install cloudscraper >> install.log
npm install jquery >> install.log
pause
