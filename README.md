[![CI](https://github.com/EladHeller/tradeBoot/actions/workflows/linter.yml/badge.svg?branch=develop)](https://github.com/EladHeller/tradeBoot/actions/workflows/linter.yml) [![CD](https://github.com/EladHeller/tradeBoot/actions/workflows/deploy.yml/badge.svg)](https://github.com/EladHeller/tradeBoot/actions/workflows/deploy.yml) [![CodeQL](https://github.com/EladHeller/wiki-bot/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/EladHeller/wiki-bot/actions/workflows/github-code-scanning/codeql)

## Wiki Bot
This bot operates in the AWS environment, and updates the Hebrew Wikipedia.

### Tasks
* Daily updates to market values of companies via [dedicated template](https://he.wikipedia.org/wiki/%D7%AA%D7%91%D7%A0%D7%99%D7%AA:%D7%A9%D7%95%D7%95%D7%99_%D7%A9%D7%95%D7%A7_%D7%97%D7%91%D7%A8%D7%94_%D7%91%D7%95%D7%A8%D7%A1%D7%90%D7%99%D7%AA). 
* Update yearly reports data.
* More tasks here - https://he.wikipedia.org/wiki/user:Sapper-bot

### AWS Architecture

#### Scheduled Bots (e.g., Market Value, Kineret Level)
```mermaid
graph LR
    Cron[EventBridge Scheduler] --> Lambda[AWS Lambda Functions]
    Lambda --> WikiAPI[Wikipedia API]
    
    subgraph Functions [Bot Functions]
        F1[MarketValueFunction]
        F2[KineretLevelFunction]
        F3[ArchiveUserTalkFunction]
        F4[...]
    end
    
    Cron -.-> Functions
```

#### Tag Bot (Full Cycle)
```mermaid
graph TD
    subgraph Wikipedia [Wikipedia Environment]
        User[User tags Bot]
        WikiNotif[Wikipedia Notification System]
        WikipediaAPI[Wikipedia API]
    end

    subgraph AWS [AWS Environment]
        SES[AWS SES]
        S3[email saved to S3]
        S3Lambda[S3 Trigger Lambda]
        SQS[SQS: tag-bot-queue]
        TagBotLambda[TagBotFunction]
    end

    User --> WikiNotif
    WikiNotif -- Sends Email --> SES
    SES --> S3
    S3 --> S3Lambda
    S3Lambda --> SQS
    SQS --> TagBotLambda
    TagBotLambda -- "1. Fetch Notification Details" --> WikipediaAPI
    TagBotLambda -- "2. Perform Action" --> WikipediaAPI
```

### CI - CD
CI run on each PR before merging to master. After merging, CD run to updates production environment.
