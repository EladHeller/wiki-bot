[![CI](https://github.com/EladHeller/tradeBoot/actions/workflows/linter.yml/badge.svg)](https://github.com/EladHeller/tradeBoot/actions/workflows/linter.yml) [![CD](https://github.com/EladHeller/tradeBoot/actions/workflows/deploy.yml/badge.svg)](https://github.com/EladHeller/tradeBoot/actions/workflows/deploy.yml) [![CodeQL](https://github.com/EladHeller/wiki-bot/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/EladHeller/wiki-bot/actions/workflows/github-code-scanning/codeql)

## Wiki Bot
This bot operates in the AWS environment, and updates the Hebrew Wikipedia.

### Tasks
* Daily updates to market values of companies via [dedicated template](https://he.wikipedia.org/wiki/%D7%AA%D7%91%D7%A0%D7%99%D7%AA:%D7%A9%D7%95%D7%95%D7%99_%D7%A9%D7%95%D7%A7_%D7%97%D7%91%D7%A8%D7%94_%D7%91%D7%95%D7%A8%D7%A1%D7%90%D7%99%D7%AA). 
* Update yearly reports data.
* More tasks here - https://he.wikipedia.org/wiki/user:Sapper-bot

### AWS Architacture
<img width="693" alt="image" src="https://user-images.githubusercontent.com/15896603/170985226-0c055ebe-1d4d-4895-8a15-ca20d68f33ec.png">

### CI - CD
CI run on each PR before merging to master. After merging, CD run to updates production environment.
