FROM public.ecr.aws/lambda/nodejs:22

# Install Playwright dependencies
RUN dnf -y update && \
    dnf -y install \
        libX11 \
        libXcomposite \
        libXcursor \
        libXdamage \
        libXext \
        libXi \
        libXrender \
        libXfixes \
        libXrandr \
        atk \
        gtk3 \
        xz \
        wget \
        alsa-lib \
        glibc-langpack-en \
        ipa-gothic-fonts \
        nss \
        nspr \
        libX11-xcb \
        mesa-dri-drivers \
        mesa-libEGL \
        pango \
        cairo \
        cups-libs \
        dbus-glib \
    && dnf clean all

# Copy the source code
COPY . .

# Build the project
RUN npm run build && \
    cp ./package.json ./dist/package.json && \
    cp ./package-lock.json ./dist/package-lock.json && \
    cd ./dist && \
    npm --quiet ci --omit=dev --no-bin-links && \
    rm -rf ./bot/__tests__ ./package-lock.json ./bot/scripts && \
    cd ..

RUN npx playwright install

# Lambda entrypoint
CMD [ "dist/ironSwords/index.main" ]
