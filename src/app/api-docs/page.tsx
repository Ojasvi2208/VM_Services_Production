'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';
import NavBar from '@/components/home/NavBar';
import SiteFooter from '@/components/home/SiteFooter';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="bg-[#060D0A] min-h-screen flex flex-col">
      <NavBar />

      <main className="pt-36 pb-20 px-4 md:px-6 lg:px-8 max-w-[1440px] mx-auto flex-1 w-full">
        <div className="mb-8">
          <h1 className="font-['Space_Grotesk'] font-bold text-4xl text-[#dce5df] tracking-tight mb-2">
            API Documentation
          </h1>
          <p className="text-[#859586] text-sm">
            REST API reference for Vijay Malik Financial Services · ARN-317605
          </p>
        </div>

        <div className="glass-card-vi rounded-2xl overflow-hidden p-1">
          {mounted && (
            <SwaggerUI
              url="/api-docs.json"
              docExpansion="list"
              defaultModelsExpandDepth={-1}
              tryItOutEnabled={false}
            />
          )}
        </div>
      </main>

      <SiteFooter />

      <style>{`
        .swagger-ui { background: transparent !important; font-family: 'Inter', sans-serif !important; }
        .swagger-ui .topbar { display: none !important; }
        .swagger-ui .info { margin: 20px 0 !important; }
        .swagger-ui .info .title { color: #dce5df !important; font-family: 'Space Grotesk', sans-serif !important; }
        .swagger-ui .info .description p { color: #859586 !important; }
        .swagger-ui .scheme-container { background: transparent !important; box-shadow: none !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; padding: 12px 20px !important; }
        .swagger-ui .opblock-tag { color: #dce5df !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; font-family: 'Space Grotesk', sans-serif !important; }
        .swagger-ui .opblock { background: rgba(255,255,255,0.02) !important; border: 1px solid rgba(255,255,255,0.05) !important; border-radius: 12px !important; margin-bottom: 8px !important; }
        .swagger-ui .opblock .opblock-summary { border: none !important; }
        .swagger-ui .opblock .opblock-summary-method { background: #44f593 !important; color: #001f10 !important; font-weight: 700 !important; border-radius: 8px !important; min-width: 60px !important; text-align: center !important; }
        .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #f59e0b !important; }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #ff4757 !important; color: white !important; }
        .swagger-ui .opblock .opblock-summary-path { color: #dce5df !important; }
        .swagger-ui .opblock .opblock-summary-description { color: #859586 !important; }
        .swagger-ui .opblock-body { background: rgba(0,0,0,0.2) !important; }
        .swagger-ui .opblock-description-wrapper p { color: #c0c9c2 !important; }
        .swagger-ui table thead tr td, .swagger-ui table thead tr th { color: #859586 !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; }
        .swagger-ui .parameter__name { color: #44f593 !important; }
        .swagger-ui .parameter__type { color: #859586 !important; }
        .swagger-ui .parameter__in { color: #859586 !important; }
        .swagger-ui input[type=text] { background: #08100d !important; color: #dce5df !important; border: 1px solid #3c4a3e !important; border-radius: 8px !important; }
        .swagger-ui select { background: #08100d !important; color: #dce5df !important; border: 1px solid #3c4a3e !important; }
        .swagger-ui .btn { background: #161d1a !important; color: #dce5df !important; border: 1px solid #3c4a3e !important; border-radius: 8px !important; }
        .swagger-ui .model-box { background: rgba(0,0,0,0.3) !important; }
        .swagger-ui section.models { border: 1px solid rgba(255,255,255,0.05) !important; border-radius: 12px !important; }
        .swagger-ui .response-col_status { color: #44f593 !important; }
        .swagger-ui .response-col_description { color: #859586 !important; }
        .swagger-ui .servers > label select { background: #08100d !important; color: #dce5df !important; border-radius: 8px !important; }
        .swagger-ui .servers > label { color: #859586 !important; }
      `}</style>
    </div>
  );
}
