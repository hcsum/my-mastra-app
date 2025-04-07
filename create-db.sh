docker run -d \
  --name pgvector \
  -p 5439:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  pgvector/pgvector:pg16
