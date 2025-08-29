import { useEffect, useState } from 'react';
import type { LaunchSettings } from '@atomicjolt/lti-client';

interface PageContext {
  course_id: string | null;
  module_id: string | null;
  page_content: string | null;
  current_element: string | null;
  page_title: string | null;
  page_url: string;
}

interface ExtendedLaunchSettings extends LaunchSettings {
  jwt?: string;
  context?: {
    id?: string;
    title?: string;
    label?: string;
  };
  resource_link?: {
    id?: string;
    title?: string;
    description?: string;
  };
}

export const useContentExtractor = (): PageContext => {
  const [context, setContext] = useState<PageContext>({
    course_id: null,
    module_id: null,
    page_content: null,
    current_element: null,
    page_title: null,
    page_url: window.location.href,
  });

  useEffect(() => {
    const extractContext = () => {
      const launchSettings = (window as any).LAUNCH_SETTINGS as ExtendedLaunchSettings;
      
      const courseId = launchSettings?.context?.id || 
                      extractFromDOM('course_id') || 
                      extractFromURL('course');
      
      const moduleId = launchSettings?.resource_link?.id || 
                      extractFromDOM('module_id') || 
                      extractFromURL('module');
      
      const pageTitle = launchSettings?.resource_link?.title || 
                       document.title || 
                       extractFromDOM('page_title');
      
      const mainContent = document.querySelector('#main-content, main, [role="main"]');
      const pageContent = mainContent?.textContent?.trim() || 
                         document.body.textContent?.substring(0, 5000) || null;
      
      const activeElement = document.activeElement;
      const currentElement = activeElement && activeElement !== document.body
        ? activeElement.textContent?.substring(0, 500) || null
        : null;

      setContext({
        course_id: courseId,
        module_id: moduleId,
        page_content: pageContent?.substring(0, 2000) || null,
        current_element: currentElement,
        page_title: pageTitle,
        page_url: window.location.href,
      });
    };

    const extractFromDOM = (key: string): string | null => {
      const metaTag = document.querySelector(`meta[name="${key}"]`);
      if (metaTag) {
        return metaTag.getAttribute('content');
      }
      
      const dataAttr = document.querySelector(`[data-${key}]`);
      if (dataAttr) {
        return dataAttr.getAttribute(`data-${key}`);
      }
      
      return null;
    };

    const extractFromURL = (param: string): string | null => {
      const urlParams = new URLSearchParams(window.location.search);
      const paramValue = urlParams.get(param) || urlParams.get(`${param}_id`);
      
      if (paramValue) {
        return paramValue;
      }
      
      const pathMatch = window.location.pathname.match(new RegExp(`${param}[s]?/([^/]+)`));
      if (pathMatch) {
        return pathMatch[1];
      }
      
      return null;
    };

    extractContext();

    const handleFocusChange = () => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement !== document.body) {
        setContext(prev => ({
          ...prev,
          current_element: activeElement.textContent?.substring(0, 500) || null,
        }));
      }
    };

    const handleNavigation = () => {
      extractContext();
    };

    document.addEventListener('focusin', handleFocusChange);
    window.addEventListener('popstate', handleNavigation);

    const observer = new MutationObserver(() => {
      extractContext();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    return () => {
      document.removeEventListener('focusin', handleFocusChange);
      window.removeEventListener('popstate', handleNavigation);
      observer.disconnect();
    };
  }, []);

  return context;
};