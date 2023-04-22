## Run lambda from cli
``` sh
aws lambda invoke \
    --function-name protect-templates-function \
    --log-type Tail \
    --payload '' \
    lambda-res.json > output-res.json
```
## stop lambda from cli
``` sh
aws lambda put-function-concurrency --function-name protect-templates-function --reserved-concurrent-executions 0
```