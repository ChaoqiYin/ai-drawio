const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig = {
  ...(isDevelopment ? {} : { output: "export" }),
  images: {
    unoptimized: true
  }
};

export default nextConfig;
