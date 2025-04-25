import { cn } from "@core/utils/cn.ts";

type FooterProps = {
  className?: string;
};

const Footer = ({ className, ...props }: FooterProps) => {
  return (
    <footer
      className={cn("flex mt-auto justify-center p-2", className)}
      {...props}
    ></footer>
  );
};

export default Footer;
