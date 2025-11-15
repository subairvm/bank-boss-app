import rupeeIcon from "@/assets/rupee-icon.jpeg";

interface RupeeIconProps {
  className?: string;
  size?: number;
}

export const RupeeIcon = ({ className = "", size = 16 }: RupeeIconProps) => {
  return (
    <img
      src={rupeeIcon}
      alt="₹"
      className={`inline-block ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
