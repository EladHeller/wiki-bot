## Run lambda from cli
``` sh
aws lambda invoke \
    --function-name run-scripts-function \
    --log-type Tail \
    --payload '' \
    lambda-res.json > output-res.json
```
## stop lambda from cli
``` sh
aws lambda put-function-concurrency --function-name run-scripts-function --reserved-concurrent-executions 0
```

## TODO
Check docker before it