# Dockerfile — Compile Validation para Chocolate Ibarra
# Valida que la app compile sin errores de TypeScript
# Uso: docker build --no-cache -t chocolate-ibarra:latest .

FROM oven/bun:1.3

WORKDIR /app

# 1. Dependencias
COPY package.json bun.lock* ./
RUN bun install 2>&1 | tail -5

# 2. Copiar código fuente + .env (si existen)
COPY . .
COPY .env* ./

# 3. Validación: TypeScript strict check
RUN echo "TypeScript check (tsc --noEmit)..." && \
    bunx tsc --noEmit 2>&1; \
    EXIT_CODE=$?; \
    if [ $EXIT_CODE -ne 0 ]; then \
        echo ""; \
        echo "❌ TYPE SCRIPT ERRORS — fix before ship"; \
        exit $EXIT_CODE; \
    else \
        echo "✅ TypeScript OK — 0 errors"; \
    fi

RUN echo "" && echo "🎯 VALIDATION PASSED — app compiles without errors"
